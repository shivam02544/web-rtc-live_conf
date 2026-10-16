import React, { useRef, useEffect } from 'react';
import { ChatMessage, FileTransferSession, DataChannelState } from '@/lib/DataChannelProtocol';

interface DataChannelPanelProps {
  dcState: DataChannelState;
  chatMessages: ChatMessage[];
  fileTransfers: Record<string, FileTransferSession>;
  currentUserId: string;
  onSendChat: (text: string) => void;
  onSendFile: (file: File) => void;
  onAcceptFile: (id: string) => void;
  onRejectFile: (id: string) => void;
  onCancelFile: (id: string) => void;
  onClose: () => void;
}

export function DataChannelPanel({
  dcState,
  chatMessages,
  fileTransfers,
  currentUserId,
  onSendChat,
  onSendFile,
  onAcceptFile,
  onRejectFile,
  onCancelFile,
  onClose
}: DataChannelPanelProps) {
  const [inputText, setInputText] = React.useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, fileTransfers]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputText.trim() && dcState === 'OPEN') {
      onSendChat(inputText.trim());
      setInputText('');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && dcState === 'OPEN') {
      onSendFile(file);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const transfersList = Object.values(fileTransfers);

  return (
    <div className="flex flex-col h-full bg-slate-950/95 backdrop-blur-xl border-l border-white/10 w-[min(22rem,100vw)] text-white shadow-2xl">
      <div className="flex items-center justify-between p-5 border-b border-white/10">
        <h3 className="font-bold text-lg flex items-center gap-3">
          Chat & Files
          <span className={`w-2.5 h-2.5 rounded-full ${dcState === 'OPEN' ? 'bg-emerald-500' : 'bg-red-500'}`} title={dcState}></span>
        </h3>
        <button onClick={onClose} className="w-9 h-9 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 flex items-center justify-center transition-colors" aria-label="Close chat">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 scrollbar-thin">
        {chatMessages.length === 0 && transfersList.length === 0 && (
          <div className="text-center text-slate-400 mt-10 text-sm">No messages yet. Start the conversation.</div>
        )}
        
        {chatMessages.map(msg => (
          <div key={msg.id} className={`flex flex-col ${msg.senderId === currentUserId ? 'items-end' : 'items-start'}`}>
            <div className={`px-4 py-2.5 rounded-2xl max-w-[85%] break-words text-sm ${msg.senderId === currentUserId ? 'bg-violet-600 text-white rounded-br-sm' : 'bg-slate-800 text-slate-100 rounded-bl-sm'}`}>
              {msg.text}
            </div>
            <span className="text-[11px] text-slate-500 mt-1">
              {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        ))}

        {transfersList.map(transfer => (
          <div key={transfer.transferId} className={`flex flex-col ${transfer.direction === 'outgoing' ? 'items-end' : 'items-start'}`}>
            <div className="p-3 rounded-xl border max-w-[95%] w-full bg-slate-800/80 border-slate-700">
              <div className="flex justify-between items-start mb-2">
                <div className="truncate flex-1 font-medium text-sm" title={transfer.fileName}>{transfer.fileName}</div>
                <div className="text-xs text-slate-400 ml-2">{(transfer.expectedSize / 1024 / 1024).toFixed(2)} MB</div>
              </div>
              
              <div className="text-xs text-slate-400 mb-2">{transfer.state}</div>

              {transfer.state === 'TRANSFERRING' && (
                <div className="w-full bg-slate-700 rounded-full h-1.5 mb-2">
                  <div className="bg-violet-500 h-1.5 rounded-full transition-all duration-200" style={{ width: `${Math.min(100, Math.round((transfer.receivedBytes / transfer.expectedSize) * 100))}%` }}></div>
                </div>
              )}

              {transfer.error && <div className="text-xs text-red-400 mb-2">{transfer.error}</div>}

              <div className="flex gap-2 justify-end mt-2">
                {transfer.state === 'OFFERED' && transfer.direction === 'incoming' && (
                  <>
                    <button onClick={() => onRejectFile(transfer.transferId)} className="px-3 py-1 text-xs bg-red-600 hover:bg-red-700 rounded-md">Reject</button>
                    <button onClick={() => onAcceptFile(transfer.transferId)} className="px-3 py-1 text-xs bg-green-600 hover:bg-green-700 rounded-md">Accept</button>
                  </>
                )}
                {(transfer.state === 'OFFERED' && transfer.direction === 'outgoing') || transfer.state === 'TRANSFERRING' ? (
                  <button onClick={() => onCancelFile(transfer.transferId)} className="px-3 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded-md">Cancel</button>
                ) : null}
                {transfer.state === 'COMPLETED' && transfer.direction === 'incoming' && transfer.objectUrl && (
                  <a href={transfer.objectUrl} download={transfer.fileName} className="px-3 py-1 text-xs bg-blue-600 hover:bg-blue-700 rounded-md text-white text-center">
                    Download
                  </a>
                )}
              </div>
            </div>
          </div>
        ))}

        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 border-t border-white/10 bg-slate-950/80">
        <form onSubmit={handleSend} className="flex gap-2">
          <button 
            type="button" 
            onClick={() => fileInputRef.current?.click()}
            disabled={dcState !== 'OPEN'}
            className="p-2.5 text-slate-400 hover:text-white disabled:opacity-50 transition-colors"
            title="Attach file"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
            </svg>
          </button>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            className="hidden"
          />
          <input
            type="text"
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            disabled={dcState !== 'OPEN'}
            placeholder={dcState === 'OPEN' ? "Type a message..." : "Connecting..."}
            className="flex-1 min-w-0 bg-slate-800 text-white rounded-xl px-4 py-3 text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500 disabled:opacity-50"
          />
          <button 
            type="submit"
            disabled={!inputText.trim() || dcState !== 'OPEN'}
            className="p-3 bg-violet-600 hover:bg-violet-500 rounded-xl text-white disabled:opacity-50 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </form>
      </div>
    </div>
  );
}
