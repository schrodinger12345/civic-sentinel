import { Draggable } from '@hello-pangea/dnd';
import { Complaint } from '@/types/complaint';
import { formatRelativeTime } from '@/lib/dateUtils';
import { Clock, AlertTriangle, MessageSquare, GripHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface KanbanCardProps {
  complaint: Complaint;
  index: number;
  isDragEnabled: boolean;
  onView: (c: Complaint) => void;
  showCitizenName?: boolean;
}

export function KanbanCard({ complaint, index, isDragEnabled, onView, showCitizenName = false }: KanbanCardProps) {
  const isEscalated = complaint.escalationLevel > 0;
  
  // Translation display logic
  const displayTitle = complaint.language === 'english' || !complaint.translatedTitle
      ? (complaint.title || complaint.description) 
      : (complaint.translatedTitle || complaint.title || complaint.description);
      
  const originalTitle = complaint.wasTranslated ? complaint.originalTitle : null;

  return (
    <Draggable draggableId={complaint.id} index={index} isDragDisabled={!isDragEnabled}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          className={`
            group relative p-3 mb-3 rounded-lg border transition-all select-none
            ${snapshot.isDragging 
              ? 'bg-background shadow-xl scale-105 border-primary ring-2 ring-primary/20 z-50' 
              : 'bg-white/5 border-white/10 hover:border-white/20 hover:bg-white/[0.07] shadow-sm'
            }
            ${isEscalated ? 'border-l-4 border-l-destructive bg-destructive/5' : ''}
          `}
          style={provided.draggableProps.style}
          onClick={() => onView(complaint)}
        >
          {/* Card Header */}
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex-1 min-w-0">
               {/* Translation Badge */}
              {originalTitle && (
                 <span className="inline-flex items-center gap-1 text-[10px] text-primary bg-primary/10 px-1.5 py-0.5 rounded mb-1">
                    <MessageSquare className="w-3 h-3" />
                    Translated from {complaint.language}
                 </span>
              )}
              
              <h4 className="text-sm font-medium leading-tight truncate" title={displayTitle}>
                {displayTitle}
              </h4>
              
              {showCitizenName && (
                <p className="text-xs text-muted-foreground mt-0.5 truncate">{complaint.citizenName}</p>
              )}
            </div>
            
            <div className={`
              px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider h-fit
              ${complaint.severity === 'critical' ? 'bg-destructive/20 text-destructive' :
                complaint.severity === 'high' ? 'bg-orange-500/20 text-orange-400' :
                complaint.severity === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                'bg-green-500/20 text-green-400'}
            `}>
              {complaint.severity}
            </div>
          </div>

          {/* Badges Row */}
          <div className="flex flex-wrap items-center gap-2 mb-3">
             {/* Priority Badge */}
            <span className={`text-[10px] font-mono px-1.5 rounded border ${
                 complaint.priority >= 8 ? 'border-destructive/30 text-destructive bg-destructive/5' :
                 complaint.priority >= 5 ? 'border-warning/30 text-warning bg-warning/5' :
                 'border-primary/30 text-primary bg-primary/5'
            }`}>
              P-{complaint.priority}
            </span>
            
            {/* Category */}
            <span className="text-[10px] text-muted-foreground bg-white/5 px-1.5 rounded capitalize">
              {complaint.category}
            </span>
            
            {/* Escalation Badge */}
            {isEscalated && (
               <span className="flex items-center gap-1 text-[10px] font-bold text-destructive animate-pulse">
                <AlertTriangle className="w-3 h-3" /> L{complaint.escalationLevel}
               </span>
            )}
          </div>
          
          {/* Footer */}
          <div className="flex items-center justify-between pt-2 border-t border-white/5">
             <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <Clock className="w-3 h-3" />
                <span>{formatRelativeTime(complaint.createdAt)}</span>
             </div>
             
             {/* Original text tooltip on hover could go here, for now just simple view action */}
          </div>
          
          {/* Status color strip on left edge handled by border-l class above */}
        </div>
      )}
    </Draggable>
  );
}
