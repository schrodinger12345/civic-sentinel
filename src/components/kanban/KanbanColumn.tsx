import { Droppable } from '@hello-pangea/dnd';
import { Complaint } from '@/types/complaint';
import { KanbanCard } from './KanbanCard';

interface KanbanColumnProps {
  id: string;
  title: string;
  count: number;
  complaints: Complaint[];
  color: string;
  isDragEnabled: boolean;
  onView: (c: Complaint) => void;
  showCitizenName?: boolean;
}

export function KanbanColumn({ 
  id, 
  title, 
  count, 
  complaints, 
  color, 
  isDragEnabled,
  onView,
  showCitizenName = false 
}: KanbanColumnProps) {
  return (
    <div className="flex flex-col h-full min-h-[500px] w-full bg-white/[0.02] rounded-xl border border-white/5 overflow-hidden">
      {/* Column Header */}
      <div className={`
        p-3 border-b border-white/5 flex items-center justify-between
        bg-opacity-10 backdrop-blur-sm
      `} style={{ backgroundColor: `${color}10` }}>
         <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold tracking-wide uppercase text-foreground/90">{title}</h3>
            <span className="text-xs font-mono bg-white/10 px-2 py-0.5 rounded-full text-muted-foreground">{count}</span>
         </div>
         <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
      </div>
      
      {/* Droppable Area */}
      <Droppable droppableId={id}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={`
              flex-1 p-3 overflow-y-auto no-scrollbar transition-colors
              ${snapshot.isDraggingOver ? 'bg-white/[0.03]' : ''}
            `}
          >
            {complaints.map((complaint, index) => (
              <KanbanCard 
                key={complaint.id} 
                complaint={complaint} 
                index={index}
                isDragEnabled={isDragEnabled}
                onView={onView}
                showCitizenName={showCitizenName}
              />
            ))}
            {provided.placeholder}
            
            {complaints.length === 0 && (
              <div className="flex flex-col items-center justify-center py-10 text-muted-foreground opacity-50 border-2 border-dashed border-white/10 rounded-lg h-32">
                 <span className="text-xs">No tickets</span>
              </div>
            )}
          </div>
        )}
      </Droppable>
    </div>
  );
}
