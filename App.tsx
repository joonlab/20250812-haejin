/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
// Copyright 2024 Google LLC

// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at

//     https://www.apache.org/licenses/LICENSE-2.0

// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import { File as GenAIFile } from '@google/genai';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { useRef, useState } from 'react';
import { generateContent, uploadFile } from './api';

const VideoUploadBox = ({ index, file, onFileChange, title, subtitle }) => {
    const fileInputRef = useRef(null);

    const handleDragOver = (e) => {
        e.preventDefault();
        e.stopPropagation();
    };

    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            onFileChange(index, e.dataTransfer.files[0]);
            e.dataTransfer.clearData();
        }
    };

    const handleClick = () => {
        fileInputRef.current.click();
    };

    const handleFileSelect = (e) => {
        if (e.target.files && e.target.files.length > 0) {
            onFileChange(index, e.target.files[0]);
        }
    };

    return (
        <div 
            className="upload-box" 
            onDragOver={handleDragOver} 
            onDrop={handleDrop}
            onClick={handleClick}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && handleClick()}
            aria-label={`Upload ${title}`}
        >
            <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileSelect} 
                accept="video/mp4,video/quicktime,video/x-msvideo,video/avi" 
                style={{ display: 'none' }} 
            />
            <div className="upload-box-content">
                {file ? (
                    <p className="file-name">{file.name}</p>
                ) : (
                    <>
                        <div className="upload-icon-wrapper">
                            <span className="upload-number">{index + 1}</span>
                            <span className="material-symbols-outlined upload-icon">movie</span>
                        </div>
                        <p>{title}</p>
                        <span>{subtitle}</span>
                        <small>(MP4, MOV, AVI)</small>
                    </>
                )}
            </div>
        </div>
    );
};

const AnalysisReport = ({ report, info, onReset }) => {
    const reportRef = useRef(null);

    const handleSavePdf = async () => {
        const reportElement = reportRef.current;
        if (!reportElement) return;

        const canvas = await html2canvas(reportElement, {
            scale: 2, 
            useCORS: true, 
            backgroundColor: '#ffffff'
        });

        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF({
            orientation: 'p',
            unit: 'px',
            format: [canvas.width, canvas.height]
        });
        
        pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
        pdf.save(`[${info.storeName}]_${info.staffName}_분석리포트.pdf`);
    };

    const handleSaveCsv = () => {
        const headers = ['평가 단계', '세부 항목', '최대 배점', '획득 점수', '피드백'];
        const rows = report.detailedReport.map(item => [
            `"${item.category}"`,
            `"${item.item}"`,
            item.maxPoints,
            item.score,
            `"${item.feedback.replace(/"/g, '""')}"`
        ]);

        const csvContent = [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
        
        // Add BOM for UTF-8 Excel compatibility
        const bom = '\uFEFF';
        const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' });
        
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `[${info.storeName}]_${info.staffName}_평가결과.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    if (!report || !info) return null;

    return (
        <div className="card report-view">
             <header className="header">
                <h1>
                    <span className="material-symbols-outlined">assessment</span>
                    분석 결과 리포트
                </h1>
            </header>
            <section className="report-section" ref={reportRef}>
                <div className="report-header">
                    <div><span className="material-symbols-outlined">storefront</span> 매장코드: <span>{info.storeCode}</span></div>
                    <div><span className="material-symbols-outlined">pin_drop</span> 매장명: <span>{info.storeName}</span></div>
                    <div><span className="material-symbols-outlined">calendar_month</span> 영상 촬영일: <span>{info.videoDate}</span></div>
                    <div><span className="material-symbols-outlined">person</span> 응대직원: <span>{info.staffName}</span></div>
                </div>

                <div className="report-summary">
                    <div className="summary-score">
                        <h3>총점</h3>
                        <p><span>{report.totalScore}</span> / 60</p>
                    </div>
                    <div className="summary-feedback">
                        <h3><span className="material-symbols-outlined">summarize</span>총평</h3>
                        <ul>
                            {report.summary.map((item, index) => (
                                <li key={index} className={item.needsImprovement ? 'needs-improvement' : ''}>
                                    <span className="material-symbols-outlined">{item.needsImprovement ? 'warning' : 'check_circle'}</span>
                                    {item.text}
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
                
                <div className="report-details">
                    <h3><span className="material-symbols-outlined">playlist_add_check</span>세부 평가 결과</h3>
                    <table>
                        <thead>
                            <tr>
                                <th>평가 항목</th>
                                <th>피드백</th>
                                <th>점수</th>
                            </tr>
                        </thead>
                        <tbody>
                            {report.detailedReport.map((item, index) => (
                                <tr key={index}>
                                    <td>{item.item}</td>
                                    <td className={item.needsImprovement ? 'needs-improvement' : ''}>{item.feedback}</td>
                                    <td>{item.maxPoints > 0 ? `${item.score} / ${item.maxPoints}` : item.score}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>
            <div className="report-actions">
                <button className="button" onClick={handleSavePdf}>
                    <span className="material-symbols-outlined">picture_as_pdf</span>
                    분석 결과 PDF 저장
                </button>
                <button className="button" onClick={handleSaveCsv}>
                    스프레드시트 저장
                </button>
                <button className="button reset-btn" onClick={onReset}>
                     <span className="material-symbols-outlined">restart_alt</span>
                    초기화 또는 다시 입력
                </button>
            </div>
        </div>
    );
};


export default function App() {
    const [storeCode, setStoreCode] = useState('');
    const [storeName, setStoreName] = useState('');
    const [videoDate, setVideoDate] = useState('2025-08-09');
    const [staffName, setStaffName] = useState('');
    const [videos, setVideos] = useState<(File | null)[]>([null, null, null]);
    
    const [status, setStatus] = useState('idle'); // 'idle', 'loading', 'success', 'error'
    const [view, setView] = useState('form'); // 'form', 'report'
    const [result, setResult] = useState(null);
    const [errorMessage, setErrorMessage] = useState('');

    const handleFileChange = (index: number, file: File) => {
        const newVideos = [...videos];
        newVideos[index] = file;
        setVideos(newVideos);
    };

    const handleReset = () => {
        setStoreCode('');
        setStoreName('');
        setVideoDate('2025-08-09');
        setStaffName('');
        setVideos([null, null, null]);
        setStatus('idle');
        setResult(null);
        setErrorMessage('');
        setView('form');
    };

    const handleAnalyze = async () => {
        if (!storeCode || !staffName || videos.every(v => v === null)) {
            setErrorMessage('매장코드, 응대직원, 그리고 하나 이상의 영상을 입력해주세요.');
            setStatus('error');
            return;
        }

        setStatus('loading');
        setErrorMessage('');
        setResult(null);

        try {
            const uploadedFiles: (GenAIFile | null)[] = await Promise.all(
                videos.map(file => file ? uploadFile(file) : Promise.resolve(null))
            );

            const validFiles = uploadedFiles.filter(f => f) as GenAIFile[];
            if (validFiles.length === 0) {
                setErrorMessage('업로드된 영상이 없습니다. 영상을 추가한 후 다시 시도해주세요.');
                setStatus('error');
                return;
            }
            
            const formData = { storeCode, storeName, videoDate, staffName };
            const response = await generateContent(formData, validFiles);
            
            try {
                const reportData = JSON.parse(response.text);
                setResult(reportData);
                setStatus('success');
                setView('report');
            } catch (jsonError) {
                console.error("JSON Parsing Error:", jsonError, "Raw text:", response.text);
                setErrorMessage('분석 결과를 처리하는 중 오류가 발생했습니다. 반환된 데이터가 올바른 형식이 아닙니다.');
                setStatus('error');
            }

        } catch (e) {
            console.error(e);
            setErrorMessage(e.message || '분석 중 오류가 발생했습니다.');
            setStatus('error');
        }
    };
    
    const isAnalyzing = status === 'loading';
    const analysisDisabled = !storeCode || !staffName || videos.every(v => v === null);

    if (view === 'report' && result) {
        return <AnalysisReport report={result} info={{ storeCode, storeName, videoDate, staffName }} onReset={handleReset} />;
    }

    return (
        <div className="container">
            <div className="card">
                <header className="header">
                    <h1>
                        <span className="material-symbols-outlined">smart_display</span>
                        매장 평가 영상 자동 분석 시스템
                    </h1>
                    <p>방문평가 영상을 체계적으로 분석하고 개선점을 제안해드립니다</p>
                </header>

                <div className="form-grid">
                    <div className="input-group">
                        <label htmlFor="store-code"><span className="material-symbols-outlined">storefront</span>매장코드</label>
                        <div className="input-wrapper">
                           <input id="store-code" type="text" placeholder="매장코드를 입력하세요(예:D123450000)" value={storeCode} onChange={e => setStoreCode(e.target.value)} disabled={isAnalyzing} />
                        </div>
                    </div>
                    <div className="input-group">
                        <label htmlFor="store-name"><span className="material-symbols-outlined">pin_drop</span>매장명</label>
                         <div className="input-wrapper">
                            <input id="store-name" type="text" placeholder="매장명을 입력하세요" value={storeName} onChange={e => setStoreName(e.target.value)} disabled={isAnalyzing}/>
                        </div>
                    </div>
                    <div className="input-group">
                        <label htmlFor="video-date"><span className="material-symbols-outlined">calendar_month</span>영상 촬영일</label>
                         <div className="input-wrapper">
                            <input id="video-date" type="date" value={videoDate} onChange={e => setVideoDate(e.target.value)} disabled={isAnalyzing} />
                        </div>
                    </div>
                    <div className="input-group">
                        <label htmlFor="staff-name"><span className="material-symbols-outlined">person</span>응대직원</label>
                         <div className="input-wrapper">
                            <input id="staff-name" type="text" placeholder="응대직원명을 입력하세요" value={staffName} onChange={e => setStaffName(e.target.value)} disabled={isAnalyzing} />
                        </div>
                    </div>
                </div>

                <section className="upload-section">
                    <VideoUploadBox index={0} file={videos[0]} onFileChange={handleFileChange} title="영상 파일 업로드" subtitle="첫 번째 영상" />
                    <VideoUploadBox index={1} file={videos[1]} onFileChange={handleFileChange} title="영상 파일 업로드" subtitle="두 번째 영상" />
                    <VideoUploadBox index={2} file={videos[2]} onFileChange={handleFileChange} title="영상 파일 업로드" subtitle="세 번째 영상" />
                </section>
                
                {status === 'idle' && (
                    <section className="info-section">
                        <h3><span className="material-symbols-outlined">lightbulb</span>분석 안내</h3>
                        <ul>
                            <li>AI가 업로드한 영상의 <strong>Voice</strong>과 <strong>Motion</strong>으로 응대 부분을 분석합니다</li>
                            <li>분석 완료 후 상세한 리포트와 개선 제안을 제공합니다</li>
                            <li>영상 품질이 좋을수록 더 정확한 분석이 가능합니다</li>
                        </ul>
                    </section>
                )}
                
                {status === 'error' && (
                    <section className="error-section">
                        <h3><span className="material-symbols-outlined">error</span>오류 발생</h3>
                        <p>{errorMessage}</p>
                    </section>
                )}

                <div className="button-group">
                    <button className="button reset-btn" onClick={handleReset} disabled={isAnalyzing}>
                        <span className="material-symbols-outlined">refresh</span>초기화
                    </button>
                    <button className="button analyze-btn" onClick={handleAnalyze} disabled={isAnalyzing || analysisDisabled}>
                        {isAnalyzing ? (
                            <>
                                <div className="loading-spinner"></div>
                                분석 중...
                            </>
                        ) : (
                            <>
                                <span className="material-symbols-outlined">rocket_launch</span>
                                분석 시작
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}