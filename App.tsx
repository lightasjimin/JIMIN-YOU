
import React, { useState, useRef, useEffect, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { ToolType, Stroke, ChatMessage, SessionSummary, QuizQuestion, Point } from './types';
import { explainConceptWithImage, explainConcept, summarizeSession, generateQuiz } from './services/geminiService';
import Canvas from './components/Canvas';

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://esm.sh/pdfjs-dist@4.10.38/build/pdf.worker.mjs';

interface SavedNote {
  id: string;
  name: string;
  date: string;
  totalPages: number;
  lastPage: number;
  previewImage?: string;
  folderId?: string;
  isDeleted?: boolean;
}

interface Folder {
  id: string;
  name: string;
  color: string;
}

const App: React.FC = () => {
  const [view, setView] = useState<'dashboard' | 'session' | 'report'>('dashboard');
  const [savedNotes, setSavedNotes] = useState<SavedNote[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string | 'all' | 'trash'>('all');
  const [movingNoteId, setMovingNoteId] = useState<string | null>(null);
  
  // Tool Settings
  const [penColor, setPenColor] = useState('#000000');
  const [penWidth, setPenWidth] = useState(2);
  const [highlighterColor, setHighlighterColor] = useState('rgba(255, 235, 59, 0.4)');
  const [highlighterWidth, setHighlighterWidth] = useState(15);
  const [eraserWidth, setEraserWidth] = useState(30);
  const [showToolSettings, setShowToolSettings] = useState(false);

  // Report Data
  const [reportData, setReportData] = useState<{
    summary: SessionSummary | null;
    quizzes: QuizQuestion[] | null;
  }>({ summary: null, quizzes: null });

  // Modals & UI State
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [showFolderRenameModal, setShowFolderRenameModal] = useState(false);
  const [showFolderDeleteModal, setShowFolderDeleteModal] = useState(false);
  const [renamingFolderId, setRenamingFolderId] = useState<string | null>(null);
  const [folderRenameValue, setFolderRenameValue] = useState('');
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [renamingNoteId, setRenamingNoteId] = useState<string | null>(null);
  const [newNoteName, setNewNoteName] = useState('');
  const [showNoteDeleteModal, setShowNoteDeleteModal] = useState(false);
  const [deletingNoteId, setDeletingNoteId] = useState<string | null>(null);
  const [showEndSessionModal, setShowEndSessionModal] = useState(false);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [feedbackOptions, setFeedbackOptions] = useState({ summary: true, points: true, quiz: true });
  
  const [splitRatio, setSplitRatio] = useState(60);
  const [activeTool, setActiveTool] = useState<ToolType>(ToolType.PEN);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [scale, setScale] = useState(1.0);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pageImages, setPageImages] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [lastBriefSummary, setLastBriefSummary] = useState<string | null>(null);
  const [isProcessingAI, setIsProcessingAI] = useState(false);

const App: React.FC = () => {
  // 모든 useState, useRef 등
  const pdfDocRef = useRef<pdfjsLib.PDFDocumentProxy | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<(HTMLDivElement | null)[]>([]);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  // ✅ return은 마지막에 위치
  return (
    <div style={{ padding: '2rem', textAlign: 'center' }}>
      <h1>Hello, 지민유!</h1>
      <p>지금 화면이 잘 표시되고 있습니다 🎉</p>
    </div>
  );
};

export default App;

  const chatEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  // Persistence
  useEffect(() => {
    const notesData = localStorage.getItem('aidear_notes');
    const foldersData = localStorage.getItem('aidear_folders');
    if (notesData) setSavedNotes(JSON.parse(notesData));
    if (foldersData) setFolders(JSON.parse(foldersData));
  }, []);

  useEffect(() => {
    localStorage.setItem('aidear_notes', JSON.stringify(savedNotes));
    localStorage.setItem('aidear_folders', JSON.stringify(folders));
  }, [savedNotes, folders]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isProcessingAI]);

  // Page Scroll Observation
  useEffect(() => {
    if (view !== 'session' || pageImages.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio > 0.5) {
            const index = pageRefs.current.indexOf(entry.target as HTMLDivElement);
            if (index !== -1) setCurrentPage(index + 1);
          }
        });
      },
      { threshold: 0.5, root: scrollContainerRef.current }
    );
    pageRefs.current.forEach((ref) => ref && observer.observe(ref));
    return () => observer.disconnect();
  }, [view, pageImages]);

  // STT Setup
  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = 'ko-KR';
      recognitionRef.current.onresult = (event: any) => {
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) setTranscript(prev => prev + event.results[i][0].transcript + ' ');
        }
      };
    }
  }, []);

  const generateBriefSummary = async (text: string) => {
    if (!text.trim()) return;
    try {
      const response = await explainConcept("음성 요약", "학습 맥락", `다음 내용을 한 줄 요약: ${text}`);
      setLastBriefSummary(response.substring(0, 30));
    } catch (e) { console.error(e); }
  };

  const startRecording = () => { if (!isRecording) { try { recognitionRef.current?.start(); setIsRecording(true); } catch (e) {} } };
  const stopRecording = () => { if (isRecording) { recognitionRef.current?.stop(); setIsRecording(false); generateBriefSummary(transcript); } };
  const toggleRecording = () => isRecording ? stopRecording() : startRecording();

  const scrollToPage = (pageNumber: number) => {
    const targetRef = pageRefs.current[pageNumber - 1];
    if (targetRef && scrollContainerRef.current) {
      targetRef.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // Folder Actions
  const handleConfirmFolder = () => {
    if (newFolderName.trim()) {
      const newFolder: Folder = {
        id: `folder-${Date.now()}`,
        name: newFolderName.trim(),
        color: ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#8b5cf6'][Math.floor(Math.random() * 6)]
      };
      setFolders(prev => [...prev, newFolder]);
      setNewFolderName('');
      setShowFolderModal(false);
    }
  };

  const handleStartFolderRename = () => {
    const folder = folders.find(f => f.id === selectedFolderId);
    if (folder) {
      setRenamingFolderId(folder.id);
      setFolderRenameValue(folder.name);
      setShowFolderRenameModal(true);
    }
  };

  const handleConfirmFolderRename = () => {
    if (folderRenameValue.trim() && renamingFolderId) {
      setFolders(prev => prev.map(f => f.id === renamingFolderId ? { ...f, name: folderRenameValue.trim() } : f));
      setShowFolderRenameModal(false);
    }
  };

  const handleConfirmDeleteFolder = () => {
    setSavedNotes(prev => prev.map(n => n.folderId === selectedFolderId ? { ...n, folderId: undefined } : n));
    setFolders(prev => prev.filter(f => f.id !== selectedFolderId));
    setSelectedFolderId('all');
    setShowFolderDeleteModal(false);
  };

  // Note Actions
  const handleStartRename = (note: SavedNote, e: React.MouseEvent) => {
    e.stopPropagation();
    setRenamingNoteId(note.id);
    setNewNoteName(note.name);
    setShowRenameModal(true);
  };

  const handleConfirmRename = () => {
    if (newNoteName.trim() && renamingNoteId) {
      setSavedNotes(prev => prev.map(n => n.id === renamingNoteId ? { ...n, name: newNoteName.trim() } : n));
      setRenamingNoteId(null);
      setNewNoteName('');
      setShowRenameModal(false);
    }
  };

  const toggleTrash = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSavedNotes(prev => prev.map(n => n.id === id ? { ...n, isDeleted: !n.isDeleted } : n));
  };

  const confirmPermanentDelete = () => {
    if (deletingNoteId) {
      setSavedNotes(prev => prev.filter(n => n.id !== deletingNoteId));
      setDeletingNoteId(null);
      setShowNoteDeleteModal(false);
    }
  };

  const handleMoveToFolder = (noteId: string, folderId?: string) => {
    setSavedNotes(prev => prev.map(n => n.id === noteId ? { ...n, folderId } : n));
    setMovingNoteId(null);
  };

  const handleEndSession = async () => {
    setShowEndSessionModal(false);
    setIsGeneratingReport(true);
    try {
      let finalSummary: SessionSummary | null = null;
      let finalQuizzes: QuizQuestion[] | null = null;
      const pdfName = pdfFile?.name || "교재";
      const notesCount = strokes.length.toString();
      if (feedbackOptions.summary || feedbackOptions.points) {
        finalSummary = await summarizeSession(pdfName, notesCount, transcript, {
          summary: feedbackOptions.summary,
          points: feedbackOptions.points
        });
      }
      if (feedbackOptions.quiz) {
        finalQuizzes = await generateQuiz(pdfName, transcript);
      }
      setReportData({ summary: finalSummary, quizzes: finalQuizzes });
      setView('report');
    } catch (e) {
      console.error(e);
      alert("리포트 생성 중 오류가 발생했습니다.");
    } finally {
      setIsGeneratingReport(false);
    }
  };

  const handleToolChange = (tool: ToolType) => {
    if (activeTool === tool) {
      if (tool !== ToolType.AI_PEN) {
        setShowToolSettings(!showToolSettings);
      }
    } else {
      setActiveTool(tool);
      if (tool !== ToolType.AI_PEN) {
        setShowToolSettings(true);
        stopRecording();
      } else {
        setShowToolSettings(false);
        startRecording();
      }
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      const file = e.target.files[0];
      setIsProcessing(true);
      try {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        const page = await pdf.getPage(1);
        const viewport = page.getViewport({ scale: 0.5 });
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.height = viewport.height; canvas.width = viewport.width;
        let preview = "";
        if (context) {
          await page.render({ canvasContext: context, viewport, canvas }).promise;
          preview = canvas.toDataURL('image/png');
        }
        const newNote: SavedNote = {
          id: `note-${Date.now()}`,
          name: file.name,
          date: new Date().toLocaleDateString(),
          totalPages: pdf.numPages,
          lastPage: 1,
          previewImage: preview,
          folderId: (selectedFolderId === 'all' || selectedFolderId === 'trash') ? undefined : selectedFolderId,
          isDeleted: false
        };
        setSavedNotes(prev => [newNote, ...prev]);
        setPdfFile(file); 
      } catch (err) { console.error(err); } finally { setIsProcessing(false); e.target.value = ''; }
    }
  };

  const openNote = async (note: SavedNote) => {
    if (note.isDeleted || !pdfFile) return;
    setIsProcessing(true);
    try {
      const arrayBuffer = await pdfFile.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      pdfDocRef.current = pdf;
      setTotalPages(pdf.numPages);
      await renderAllPages(pdf);
      setView('session');
      setMessages([{ id: '1', role: 'assistant', content: `"${note.name}" 학습을 시작합니다.`, timestamp: Date.now() }]);
      setStrokes([]);
      setTranscript('');
    } catch (e) { console.error(e); } finally { setIsProcessing(false); }
  };

  const renderAllPages = async (pdfDoc: pdfjsLib.PDFDocumentProxy) => {
    const images: string[] = [];
    for (let i = 1; i <= pdfDoc.numPages; i++) {
      const page = await pdfDoc.getPage(i);
      const viewport = page.getViewport({ scale: 2.0 });
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      canvas.height = viewport.height;
      canvas.width = viewport.width;
      if (context) {
        await page.render({ canvasContext: context, viewport, canvas }).promise;
        images.push(canvas.toDataURL('image/png'));
      }
    }
    setPageImages(images);
  };

  const handleStrokeComplete = (stroke: Stroke) => {
    setStrokes(prev => [...prev, stroke]);
    if (stroke.type === ToolType.AI_PEN) analyzeAiPenArea(stroke);
  };

  const analyzeAiPenArea = async (stroke: Stroke) => {
    setIsProcessingAI(true);
    startRecording();
    setMessages(prev => [...prev, { id: `ai-pen-${Date.now()}`, role: 'user', content: "(AI 분석 중...)", timestamp: Date.now() }]);
    try {
      const pageImage = pageImages[stroke.page - 1];
      if (pageImage) {
        const res = await explainConceptWithImage(pageImage.split(',')[1], "이 이미지에서 표시된 영역의 개념을 설명해주세요.");
        setMessages(prev => [...prev, { id: Date.now().toString(), role: 'assistant', content: res, timestamp: Date.now() }]);
      }
    } catch (e) { console.error(e); } finally { setIsProcessingAI(false); }
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!chatInput.trim() || isProcessingAI) return;
    startRecording();
    const txt = chatInput; setChatInput('');
    setMessages(prev => [...prev, { id: Date.now().toString(), role: 'user', content: txt, timestamp: Date.now() }]);
    setIsProcessingAI(true);
    try {
      const res = await explainConcept(pdfFile?.name || "문서", `현재 ${currentPage}페이지 맥락`, txt);
      setMessages(prev => [...prev, { id: Date.now().toString(), role: 'assistant', content: res, timestamp: Date.now() }]);
    } catch (e) { console.error(e); } finally { setIsProcessingAI(false); }
  };

  const filteredNotes = savedNotes.filter(n => {
    if (selectedFolderId === 'trash') return n.isDeleted;
    if (n.isDeleted) return false;
    if (selectedFolderId === 'all') return true;
    return n.folderId === selectedFolderId;
  });

  const selectedFolder = folders.find(f => f.id === selectedFolderId);

  // DASHBOARD VIEW
  if (view === 'dashboard') {
    return (
      <div className="min-h-screen bg-[#f3f4f6] flex flex-col font-sans">
        <header className="h-16 bg-white border-b flex items-center justify-between px-8 sticky top-0 z-50">
          <div className="flex items-center space-x-2">
            <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg"><i className="fas fa-brain"></i></div>
            <h1 className="text-xl font-black text-gray-900 tracking-tighter">Aidear</h1>
          </div>
          <div className="flex items-center space-x-3">
            <button onClick={() => setShowFolderModal(true)} className="px-4 py-2 rounded-full border border-gray-200 text-xs font-bold hover:bg-gray-50 flex items-center space-x-2 transition-all bg-white shadow-sm">
              <i className="fas fa-folder-plus text-indigo-600"></i>
              <span>폴더 생성</span>
            </button>
            <label className="bg-indigo-600 text-white px-5 py-2 rounded-full text-xs font-black hover:bg-indigo-700 transition-all cursor-pointer flex items-center space-x-2 shadow-xl">
              <i className="fas fa-file-upload"></i>
              <span>{isProcessing ? '처리 중...' : '새 노트 추가'}</span>
              <input type="file" className="hidden" accept="application/pdf" onChange={handleFileUpload} disabled={isProcessing} />
            </label>
          </div>
        </header>

        <div className="flex flex-grow overflow-hidden">
          <aside className="w-64 bg-white border-r p-6 overflow-y-auto hidden md:block">
            <nav className="space-y-1">
              <button onClick={() => setSelectedFolderId('all')} className={`w-full text-left px-4 py-3 rounded-xl text-xs font-bold flex items-center space-x-3 transition-all ${selectedFolderId === 'all' ? 'bg-indigo-50 text-indigo-600' : 'text-gray-500 hover:bg-gray-50'}`}>
                <i className="fas fa-layer-group"></i>
                <span>전체 보관함</span>
              </button>
              <div className="pt-6 pb-2">
                <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 px-2">나의 폴더</h3>
                <div className="space-y-1">
                  {folders.map(f => (
                    <button key={f.id} onClick={() => setSelectedFolderId(f.id)} className={`w-full text-left px-4 py-3 rounded-xl text-xs font-bold flex items-center space-x-3 transition-all ${selectedFolderId === f.id ? 'bg-indigo-50 text-indigo-600' : 'text-gray-500 hover:bg-gray-50'}`}>
                      <i className="fas fa-folder" style={{ color: f.color }}></i>
                      <span className="truncate">{f.name}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="pt-6 border-t mt-6">
                <button onClick={() => setSelectedFolderId('trash')} className={`w-full text-left px-4 py-3 rounded-xl text-xs font-bold flex items-center space-x-3 transition-all ${selectedFolderId === 'trash' ? 'bg-red-50 text-red-500' : 'text-gray-500 hover:bg-red-50'}`}>
                  <i className="fas fa-trash-alt"></i>
                  <span>휴지통</span>
                </button>
              </div>
            </nav>
          </aside>

          <main className="flex-grow p-10 overflow-y-auto bg-gray-50/50">
            <div className="max-w-7xl mx-auto">
              <div className="flex items-center justify-between mb-10">
                <div className="flex items-center space-x-4">
                  <h2 className="text-3xl font-black text-gray-900 tracking-tight">
                    {selectedFolderId === 'all' ? '전체 보관함' : selectedFolderId === 'trash' ? '휴지통' : selectedFolder?.name}
                  </h2>
                  {selectedFolder && (
                    <div className="flex space-x-2">
                      <button onClick={handleStartFolderRename} className="w-8 h-8 rounded-full bg-white border flex items-center justify-center text-gray-400 hover:text-indigo-600"><i className="fas fa-pen text-[10px]"></i></button>
                      <button onClick={() => setShowFolderDeleteModal(true)} className="w-8 h-8 rounded-full bg-white border flex items-center justify-center text-gray-400 hover:text-red-500"><i className="fas fa-trash-alt text-[10px]"></i></button>
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-8">
                {filteredNotes.map((note) => (
                  <div key={note.id} className="group flex flex-col space-y-3">
                    <div onClick={() => openNote(note)} className="aspect-[3/4] bg-white rounded-3xl border border-gray-200 overflow-hidden relative shadow-sm hover:shadow-2xl hover:-translate-y-2 transition-all cursor-pointer">
                      {note.previewImage ? <img src={note.previewImage} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center bg-gray-50 text-gray-200"><i className="fas fa-file-pdf text-4xl"></i></div>}
                      <div className="absolute top-3 right-3 flex space-x-1 opacity-0 group-hover:opacity-100 transition-all">
                        {note.isDeleted ? (
                          <>
                            <button onClick={(e) => toggleTrash(note.id, e)} className="w-8 h-8 bg-white/90 rounded-full flex items-center justify-center text-blue-600 shadow-lg"><i className="fas fa-undo"></i></button>
                            <button onClick={(e) => { e.stopPropagation(); setDeletingNoteId(note.id); setShowNoteDeleteModal(true); }} className="w-8 h-8 bg-white/90 rounded-full flex items-center justify-center text-red-600 shadow-lg"><i className="fas fa-times"></i></button>
                          </>
                        ) : (
                          <>
                            <button onClick={(e) => handleStartRename(note, e)} className="w-8 h-8 bg-white/90 rounded-full flex items-center justify-center text-green-600 shadow-lg"><i className="fas fa-pencil-alt text-[10px]"></i></button>
                            <button onClick={(e) => { e.stopPropagation(); setMovingNoteId(movingNoteId === note.id ? null : note.id); }} className="w-8 h-8 bg-white/90 rounded-full flex items-center justify-center text-indigo-600 shadow-lg"><i className="fas fa-folder-open"></i></button>
                            <button onClick={(e) => toggleTrash(note.id, e)} className="w-8 h-8 bg-white/90 rounded-full flex items-center justify-center text-gray-400 shadow-lg hover:text-red-500"><i className="fas fa-trash-alt"></i></button>
                          </>
                        )}
                      </div>
                      {movingNoteId === note.id && (
                        <div className="absolute inset-0 bg-white/95 p-4 overflow-y-auto z-10" onClick={e => e.stopPropagation()}>
                          <div className="flex justify-between mb-4">
                            <span className="text-[10px] font-black uppercase text-gray-400">폴더 이동</span>
                            <button onClick={() => setMovingNoteId(null)}><i className="fas fa-times text-gray-400"></i></button>
                          </div>
                          <div className="space-y-2">
                            <button onClick={() => handleMoveToFolder(note.id, undefined)} className="w-full text-left p-3 rounded-xl text-xs font-bold bg-gray-50 hover:bg-indigo-50">기본 보관함</button>
                            {folders.map(f => (
                              <button key={f.id} onClick={() => handleMoveToFolder(note.id, f.id)} className="w-full text-left p-3 rounded-xl text-xs font-bold bg-gray-50 hover:bg-indigo-50 flex items-center space-x-2">
                                <i className="fas fa-circle text-[8px]" style={{ color: f.color }}></i>
                                <span>{f.name}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="px-1">
                      <h4 className="font-bold text-gray-800 text-sm truncate">{note.name}</h4>
                      <div className="flex items-center justify-between mt-1 text-[10px] text-gray-400 font-bold">
                        <span>{note.date}</span>
                        <span className="text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">{note.totalPages}P</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </main>
        </div>

        {/* Dash Modals */}
        {(showFolderModal || showFolderRenameModal || showFolderDeleteModal || showRenameModal || showNoteDeleteModal) && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/40 backdrop-blur-sm">
            <div className="bg-white rounded-[32px] p-8 w-full max-w-sm shadow-2xl">
              {showFolderModal && (
                <>
                  <h3 className="text-xl font-black mb-6">새 폴더 만들기</h3>
                  <input type="text" value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)} className="w-full px-5 py-4 bg-gray-50 border rounded-2xl mb-6 outline-none focus:ring-2 ring-indigo-500" placeholder="폴더 이름" />
                  <div className="flex space-x-3">
                    <button onClick={() => setShowFolderModal(false)} className="flex-1 py-4 text-xs font-black text-gray-400">취소</button>
                    <button onClick={handleConfirmFolder} className="flex-1 py-4 text-xs font-black bg-indigo-600 text-white rounded-2xl">생성</button>
                  </div>
                </>
              )}
              {showFolderRenameModal && (
                <>
                  <h3 className="text-xl font-black mb-6">폴더 이름 변경</h3>
                  <input type="text" value={folderRenameValue} onChange={(e) => setFolderRenameValue(e.target.value)} className="w-full px-5 py-4 bg-gray-50 border rounded-2xl mb-6 outline-none focus:ring-2 ring-indigo-500" />
                  <div className="flex space-x-3">
                    <button onClick={() => setShowFolderRenameModal(false)} className="flex-1 py-4 text-xs font-black text-gray-400">취소</button>
                    <button onClick={handleConfirmFolderRename} className="flex-1 py-4 text-xs font-black bg-indigo-600 text-white rounded-2xl">변경</button>
                  </div>
                </>
              )}
              {showFolderDeleteModal && (
                <>
                  <h3 className="text-xl font-black mb-2 text-red-600">폴더 삭제</h3>
                  <p className="text-xs text-gray-500 mb-6 font-bold">폴더 안의 노트들은 전체 보관함으로 이동됩니다. 정말 삭제하시겠습니까?</p>
                  <div className="flex space-x-3">
                    <button onClick={() => setShowFolderDeleteModal(false)} className="flex-1 py-4 text-xs font-black text-gray-400">취소</button>
                    <button onClick={handleConfirmDeleteFolder} className="flex-1 py-4 text-xs font-black bg-red-600 text-white rounded-2xl">삭제</button>
                  </div>
                </>
              )}
              {showRenameModal && (
                <>
                  <h3 className="text-xl font-black mb-6">노트 이름 변경</h3>
                  <input type="text" value={newNoteName} onChange={(e) => setNewNoteName(e.target.value)} className="w-full px-5 py-4 bg-gray-50 border rounded-2xl mb-6 outline-none focus:ring-2 ring-indigo-500" />
                  <div className="flex space-x-3">
                    <button onClick={() => setShowRenameModal(false)} className="flex-1 py-4 text-xs font-black text-gray-400">취소</button>
                    <button onClick={handleConfirmRename} className="flex-1 py-4 text-xs font-black bg-indigo-600 text-white rounded-2xl">변경</button>
                  </div>
                </>
              )}
              {showNoteDeleteModal && (
                <>
                  <h3 className="text-xl font-black mb-2 text-red-600">노트 영구 삭제</h3>
                  <p className="text-xs text-gray-500 mb-6 font-bold">삭제된 노트는 복구할 수 없습니다. 계속하시겠습니까?</p>
                  <div className="flex space-x-3">
                    <button onClick={() => setShowNoteDeleteModal(false)} className="flex-1 py-4 text-xs font-black text-gray-400">취소</button>
                    <button onClick={confirmPermanentDelete} className="flex-1 py-4 text-xs font-black bg-red-600 text-white rounded-2xl">영구 삭제</button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  // REPORT VIEW
  if (view === 'report') {
    return (
      <div className="h-screen bg-white flex flex-col font-sans">
        <header className="h-20 bg-white border-b flex items-center justify-between px-12 shrink-0 z-50">
          <div className="flex items-center space-x-4">
            <div className="w-10 h-10 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg"><i className="fas fa-chart-line"></i></div>
            <h1 className="text-2xl font-black text-gray-900 tracking-tighter">학습 마무리 리포트</h1>
          </div>
          <div className="flex space-x-3">
            <button onClick={() => setView('session')} className="px-6 py-2.5 rounded-xl border border-gray-200 text-sm font-black text-gray-500 hover:bg-gray-50 transition-all">이어서 학습하기</button>
            <button onClick={() => setView('dashboard')} className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-black hover:bg-indigo-700 shadow-xl shadow-indigo-100 transition-all">대시보드로 돌아가기</button>
          </div>
        </header>
        <div className="flex-grow overflow-y-auto bg-gray-50/30">
          <main className="max-w-4xl mx-auto w-full py-16 px-8 min-h-full">
            {reportData.summary && reportData.summary.overview && (
              <section className="mb-16 animate-in fade-in slide-in-from-bottom-4 duration-700">
                <h2 className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.2em] mb-4">Summary</h2>
                <div className="bg-indigo-50/50 p-8 rounded-[40px] border border-indigo-100 shadow-sm">
                  <p className="text-xl font-bold text-gray-800 leading-relaxed">"{reportData.summary.overview}"</p>
                </div>
              </section>
            )}
            {reportData.summary && (reportData.summary.keyPoints.length > 0 || reportData.summary.examPoints.length > 0) && (
              <section className="mb-16 grid grid-cols-1 md:grid-cols-2 gap-8">
                {reportData.summary.keyPoints.length > 0 && (
                  <div>
                    <h2 className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.2em] mb-6">Key Points</h2>
                    <div className="space-y-4">
                      {reportData.summary.keyPoints.map((point, i) => (
                        <div key={i} className="flex items-start space-x-3 bg-white p-5 rounded-3xl border border-gray-100 shadow-sm transition-all hover:shadow-md">
                          <div className="w-6 h-6 bg-indigo-50 rounded-lg flex items-center justify-center text-[10px] font-black text-indigo-600">{i+1}</div>
                          <p className="text-sm font-bold text-gray-700">{point}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {reportData.summary.examPoints.length > 0 && (
                  <div>
                    <h2 className="text-[10px] font-black text-purple-600 uppercase tracking-[0.2em] mb-6">Exam Focus</h2>
                    <div className="space-y-4">
                      {reportData.summary.examPoints.map((point, i) => (
                        <div key={i} className="flex items-start space-x-3 bg-white p-5 rounded-3xl border border-purple-100 shadow-sm transition-all hover:shadow-md">
                          <i className="fas fa-star text-purple-500 mt-1"></i>
                          <p className="text-sm font-bold text-gray-700">{point}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </section>
            )}
            {reportData.quizzes && reportData.quizzes.length > 0 && (
              <section className="mb-24">
                <h2 className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.2em] mb-8">Review Quiz</h2>
                <div className="space-y-12">
                  {reportData.quizzes.map((quiz, i) => (
                    <div key={i} className="bg-white border border-gray-100 p-8 rounded-[40px] relative overflow-hidden group hover:border-indigo-200 transition-all shadow-sm">
                      <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity"><i className="fas fa-question text-6xl"></i></div>
                      <p className="text-lg font-black text-gray-900 mb-6 leading-tight">Q{i+1}. {quiz.question}</p>
                      {quiz.options && (
                        <div className="grid grid-cols-1 gap-3 mb-8">
                          {quiz.options.map((opt, oi) => (
                            <div key={oi} className="px-6 py-4 bg-gray-50 rounded-2xl text-sm font-bold text-gray-600 border border-gray-50">{opt}</div>
                          ))}
                        </div>
                      )}
                      <details className="group/ans">
                        <summary className="list-none cursor-pointer inline-flex items-center space-x-2 text-indigo-600 font-black text-xs uppercase tracking-widest bg-indigo-50 px-4 py-2 rounded-full hover:bg-indigo-100 transition-all">
                          <span>정답 확인하기</span>
                          <i className="fas fa-chevron-down text-[8px] group-open/ans:rotate-180 transition-transform"></i>
                        </summary>
                        <div className="mt-6 p-6 bg-indigo-600 text-white rounded-3xl animate-in zoom-in-95 duration-300">
                          <div className="flex items-center space-x-2 mb-2">
                            <i className="fas fa-check-circle"></i>
                            <span className="font-black text-xs uppercase tracking-widest">Answer</span>
                          </div>
                          <p className="text-lg font-black mb-3">{quiz.answer}</p>
                          <p className="text-sm font-bold text-indigo-100 leading-relaxed opacity-90">{quiz.explanation}</p>
                        </div>
                      </details>
                    </div>
                  ))}
                </div>
              </section>
            )}
            <div className="text-center pb-24 border-t pt-12">
              <p className="text-gray-400 text-xs font-bold mb-6">오늘도 수고하셨습니다. Aidear와 함께 성장의 기록을 쌓아가세요.</p>
              <button onClick={() => setView('dashboard')} className="px-12 py-4 bg-gray-900 text-white rounded-[24px] text-sm font-black hover:scale-105 transition-transform shadow-2xl">대시보드로 돌아가기</button>
            </div>
          </main>
        </div>
      </div>
    );
  }

  // SESSION VIEW
  return (
    <div className="flex h-screen w-full bg-white overflow-hidden font-sans relative">
      <div style={{ width: `${splitRatio}%` }} className="h-full flex flex-col bg-gray-50/30 border-r border-gray-100">
        <div className="h-16 bg-white border-b flex items-center justify-between px-6 sticky top-0 z-50">
          <div className="flex items-center space-x-4">
            <button onClick={() => setView('dashboard')} className="w-10 h-10 rounded-2xl hover:bg-gray-100 flex items-center justify-center text-gray-500 transition-all"><i className="fas fa-chevron-left"></i></button>
            <div className="flex bg-gray-100/50 p-1 rounded-2xl border border-gray-100 relative group">
              {[ToolType.PEN, ToolType.HIGHLIGHTER, ToolType.ERASER].map(t => (
                <button key={t} onClick={() => handleToolChange(t)} className={`w-9 h-9 flex items-center justify-center rounded-xl transition-all ${activeTool === t ? 'bg-white shadow-md text-indigo-600' : 'text-gray-400'}`}>
                  <i className={`fas fa-${t === ToolType.PEN ? 'pen' : t === ToolType.HIGHLIGHTER ? 'highlighter' : 'eraser'} text-sm`}></i>
                </button>
              ))}
              <div className="w-px h-5 bg-gray-200 mx-2 self-center"></div>
              <button onClick={() => handleToolChange(ToolType.AI_PEN)} className={`px-4 h-9 flex items-center justify-center rounded-xl transition-all space-x-2 ${activeTool === ToolType.AI_PEN ? 'bg-indigo-600 text-white shadow-lg' : 'text-indigo-600 font-black'}`}>
                <i className="fas fa-magic text-xs"></i>
                <span className="text-[10px] font-black uppercase tracking-widest">AI 펜</span>
              </button>

              {showToolSettings && (activeTool === ToolType.PEN || activeTool === ToolType.HIGHLIGHTER || activeTool === ToolType.ERASER) && (
                <div className="absolute top-full mt-3 left-0 bg-white border border-gray-100 shadow-2xl rounded-2xl p-4 z-[60] flex flex-col space-y-4 animate-in slide-in-from-top-2 duration-200 w-48 max-h-[300px] overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-indigo-200">
                  {activeTool !== ToolType.ERASER && (
                    <div className="space-y-2">
                      <span className="text-[9px] font-black uppercase text-gray-400 tracking-widest">Colors</span>
                      <div className="grid grid-cols-5 gap-2">
                        {(activeTool === ToolType.PEN 
                          ? ['#000000', '#ef4444', '#3b82f6', '#10b981', '#f59e0b']
                          : ['rgba(255, 235, 59, 0.4)', 'rgba(239, 68, 68, 0.4)', 'rgba(59, 130, 246, 0.4)', 'rgba(16, 185, 129, 0.4)', 'rgba(168, 85, 247, 0.4)']
                        ).map(c => (
                          <button 
                            key={c} 
                            onClick={() => activeTool === ToolType.PEN ? setPenColor(c) : setHighlighterColor(c)}
                            className={`w-5 h-5 rounded-full border-2 transition-transform hover:scale-125 ${
                              (activeTool === ToolType.PEN ? penColor === c : highlighterColor === c) ? 'border-indigo-600 scale-110' : 'border-transparent'
                            }`}
                            style={{ backgroundColor: c }}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-[9px] font-black uppercase text-gray-400 tracking-widest">Thickness</span>
                      <span className="text-[10px] font-bold text-indigo-600">
                        {activeTool === ToolType.PEN ? penWidth : activeTool === ToolType.HIGHLIGHTER ? highlighterWidth : eraserWidth}px
                      </span>
                    </div>
                    <input 
                      type="range" 
                      min={activeTool === ToolType.PEN ? "1" : "5"} 
                      max={activeTool === ToolType.PEN ? "10" : activeTool === ToolType.HIGHLIGHTER ? "40" : "100"} 
                      value={activeTool === ToolType.PEN ? penWidth : activeTool === ToolType.HIGHLIGHTER ? highlighterWidth : eraserWidth}
                      onChange={(e) => {
                        const val = parseInt(e.target.value);
                        if (activeTool === ToolType.PEN) setPenWidth(val);
                        else if (activeTool === ToolType.HIGHLIGHTER) setHighlighterWidth(val);
                        else setEraserWidth(val);
                      }}
                      className="w-full h-1 accent-indigo-600 bg-gray-100 rounded-full appearance-none" 
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center space-x-3 px-6 py-2 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full text-white shadow-lg">
            <span className="text-[10px] font-black">{lastBriefSummary || "Continuous Learning Mode"}</span>
          </div>
          <div className="flex items-center space-x-3 px-4 bg-gray-50 py-1.5 rounded-full border">
            <input type="range" min="0.5" max="2.0" step="0.1" value={scale} onChange={(e) => setScale(parseFloat(e.target.value))} className="w-16 accent-indigo-600 h-1" />
            <span className="text-[10px] font-black text-indigo-600 w-8">{Math.round(scale * 100)}%</span>
            <div className="w-px h-3 bg-gray-200 mx-1"></div>
            <div className="flex items-center bg-white rounded-lg border shadow-sm px-2 py-0.5 space-x-1">
              <button onClick={() => { if (currentPage > 1) scrollToPage(currentPage - 1); }} className="w-5 h-5 flex items-center justify-center text-gray-400 hover:text-indigo-600"><i className="fas fa-chevron-left text-[8px]"></i></button>
              <input type="text" value={currentPage} onChange={(e) => { const val = parseInt(e.target.value); if (!isNaN(val) && val >= 1 && val <= totalPages) scrollToPage(val); }} className="w-6 text-center text-[10px] font-black text-indigo-600 bg-transparent outline-none" />
              <span className="text-[10px] font-bold text-gray-300">/</span>
              <span className="text-[10px] font-bold text-gray-500 pr-1">{totalPages}</span>
              <button onClick={() => { if (currentPage < totalPages) scrollToPage(currentPage + 1); }} className="w-5 h-5 flex items-center justify-center text-gray-400 hover:text-indigo-600"><i className="fas fa-chevron-right text-[8px]"></i></button>
            </div>
          </div>
        </div>
        <div ref={scrollContainerRef} className="flex-grow overflow-y-auto overflow-x-hidden p-6 bg-gray-100/30 scroll-smooth" onClick={() => setShowToolSettings(false)}>
          <div className="flex flex-col items-center space-y-4 pb-24" style={{ transform: `scale(${scale})`, transformOrigin: 'top center' }}>
            {pageImages.map((img, idx) => (
              <div key={idx} ref={el => { pageRefs.current[idx] = el; }} className="bg-white relative overflow-hidden flex-shrink-0 shadow-md">
                <img src={img} className="w-full block select-none pointer-events-none" style={{ minWidth: '600px' }} />
                <div className="absolute inset-0 z-10">
                  <Canvas 
                    tool={activeTool} 
                    strokes={strokes} 
                    onStrokeComplete={handleStrokeComplete} 
                    currentPage={idx + 1} 
                    scale={scale}
                    penColor={penColor}
                    penWidth={penWidth}
                    highlighterColor={highlighterColor}
                    highlighterWidth={highlighterWidth}
                    eraserWidth={eraserWidth}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="w-1 cursor-col-resize hover:bg-indigo-500 bg-gray-100 transition-colors" onMouseDown={(e) => { const onMouseMove = (moveEvent: MouseEvent) => { const newRatio = (moveEvent.clientX / window.innerWidth) * 100; if (newRatio > 30 && newRatio < 70) setSplitRatio(newRatio); }; const onMouseUp = () => { window.removeEventListener('mousemove', onMouseMove); window.removeEventListener('mouseup', onMouseUp); }; window.addEventListener('mousemove', onMouseMove); window.addEventListener('mouseup', onMouseUp); }}></div>
      <div style={{ width: `${100 - splitRatio}%` }} className="h-full flex flex-col bg-white">
        <div className="h-16 bg-white border-b flex items-center justify-between px-6">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-indigo-600 rounded-xl flex items-center justify-center text-white"><i className="fas fa-robot text-xs"></i></div>
            <h2 className="text-xs font-black text-gray-900 uppercase">Aidear Tutor</h2>
          </div>
          <div className="flex items-center space-x-2">
            <button onClick={() => setShowEndSessionModal(true)} className="px-3 py-1.5 bg-gray-900 text-white text-[10px] font-black rounded-lg hover:bg-indigo-600 transition-all">학습 종료</button>
            <button onClick={toggleRecording} className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${isRecording ? 'bg-red-500 text-white animate-pulse' : 'bg-gray-100 text-gray-400'}`}><i className={`fas fa-${isRecording ? 'stop' : 'microphone'}`}></i></button>
          </div>
        </div>
        <div className="flex-grow overflow-y-auto p-8 space-y-6 bg-gray-50/20">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] px-5 py-4 rounded-3xl text-[13px] leading-relaxed shadow-sm ${msg.role === 'user' ? 'bg-indigo-600 text-white' : msg.role === 'system' ? 'bg-gray-200 text-gray-500 italic text-xs' : 'bg-white border text-gray-800 whitespace-pre-wrap'}`}>
                {msg.content}
              </div>
            </div>
          ))}
          {isProcessingAI && <div className="text-indigo-500 text-[10px] font-black animate-pulse">Thinking...</div>}
          <div ref={chatEndRef} />
        </div>
        <div className="p-6 bg-white border-t">
          <form onSubmit={handleSendMessage} className="flex items-center bg-gray-100 rounded-3xl px-6 py-3.5 border focus-within:bg-white focus-within:border-indigo-200 transition-all shadow-inner">
            <input type="text" value={chatInput} onChange={(e) => setChatInput(e.target.value)} placeholder="질문해보세요..." className="bg-transparent flex-grow text-xs outline-none" />
            <button type="submit" className="text-indigo-600 ml-4"><i className="fas fa-paper-plane"></i></button>
          </form>
        </div>
      </div>
      {isGeneratingReport && (
        <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-white/90 backdrop-blur-md animate-in fade-in duration-500">
          <div className="relative w-24 h-24 mb-8">
            <div className="absolute inset-0 border-4 border-indigo-100 rounded-full"></div>
            <div className="absolute inset-0 border-4 border-indigo-600 rounded-full border-t-transparent animate-spin"></div>
            <div className="absolute inset-0 flex items-center justify-center text-indigo-600">
              <i className="fas fa-brain text-2xl animate-pulse"></i>
            </div>
          </div>
          <h2 className="text-xl font-black text-gray-900 tracking-tight mb-2">학습 리포트 생성 중</h2>
          <p className="text-xs text-gray-400 font-bold animate-pulse">Gemini가 소중한 학습 데이터를 분석하고 있습니다...</p>
        </div>
      )}
      {showEndSessionModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-[32px] p-8 w-full max-w-sm shadow-2xl">
            <h3 className="text-xl font-black mb-2">학습을 마칠까요?</h3>
            <p className="text-xs text-gray-500 mb-8 font-bold">생성할 리포트 옵션을 선택해주세요.</p>
            <div className="space-y-3 mb-8">
              {[
                { id: 'summary', label: 'PDF 전체 요약', icon: 'file-alt' },
                { id: 'points', label: '핵심 포인트 추출', icon: 'lightbulb' },
                { id: 'quiz', label: '복습 퀴즈 생성', icon: 'question-circle' }
              ].map(opt => (
                <button 
                  key={opt.id}
                  onClick={() => setFeedbackOptions(prev => ({ ...prev, [opt.id]: !prev[opt.id as keyof typeof prev] }))}
                  className={`w-full flex items-center justify-between p-4 rounded-2xl border-2 transition-all ${feedbackOptions[opt.id as keyof typeof feedbackOptions] ? 'border-indigo-600 bg-indigo-50 text-indigo-600' : 'border-gray-100 text-gray-400'}`}
                >
                  <div className="flex items-center space-x-3">
                    <i className={`fas fa-${opt.icon}`}></i>
                    <span className="text-xs font-black">{opt.label}</span>
                  </div>
                  {feedbackOptions[opt.id as keyof typeof feedbackOptions] && <i className="fas fa-check-circle"></i>}
                </button>
              ))}
            </div>
            <div className="flex space-x-3">
              <button onClick={() => setShowEndSessionModal(false)} className="flex-1 py-4 text-xs font-black text-gray-400">취소</button>
              <button 
                onClick={handleEndSession} 
                disabled={isGeneratingReport}
                className="flex-1 py-4 text-xs font-black bg-indigo-600 text-white rounded-2xl shadow-lg shadow-indigo-200 flex items-center justify-center"
              >
                {isGeneratingReport ? <i className="fas fa-spinner fa-spin mr-2"></i> : '선택 완료'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
