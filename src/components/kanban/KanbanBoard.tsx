import { DragDropContext, DropResult } from '@hello-pangea/dnd';
import { KanbanColumn } from './KanbanColumn';
import { Complaint } from '@/types/complaint';

interface KanbanBoardProps {
  complaints: Complaint[];
  onDragEnd: (result: DropResult) => void;
  onView: (c: Complaint) => void;
  isDragEnabled?: boolean;
  showCitizenName?: boolean;
  columnTitles?: {
    todo?: string;
    in_progress?: string;
    done?: string;
  };
}

export function KanbanBoard({ 
  complaints, 
  onDragEnd, 
  onView,
  isDragEnabled = true,
  showCitizenName = false,
  columnTitles = {
    todo: 'To Do',
    in_progress: 'In Progress',
    done: 'Done'
  }
}: KanbanBoardProps) {
  
  // Group complaints by status category
  // MAPPING:
  // To Do: analyzed, assigned, submitted
  // In Progress: in_progress, acknowledged, on_hold, sla_warning, escalated
  // Done: resolved

  const todoComplaints = complaints.filter(c => 
    ['analyzed', 'assigned', 'submitted'].includes(c.status)
  ).sort((a, b) => b.priority - a.priority); // High priority first

  const inProgressComplaints = complaints.filter(c => 
    ['in_progress', 'acknowledged', 'on_hold', 'sla_warning', 'escalated'].includes(c.status)
  ).sort((a, b) => b.priority - a.priority);

  const doneComplaints = complaints.filter(c => 
    c.status === 'resolved'
  ).sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-full">
        <KanbanColumn
          id="todo"
          title={columnTitles.todo || 'To Do'}
          count={todoComplaints.length}
          complaints={todoComplaints}
          color="#3b82f6" // blue-500
          isDragEnabled={isDragEnabled}
          onView={onView}
          showCitizenName={showCitizenName}
        />
        
        <KanbanColumn
          id="in_progress"
          title={columnTitles.in_progress || 'In Progress'}
          count={inProgressComplaints.length}
          complaints={inProgressComplaints}
          color="#f59e0b" // amber-500
          isDragEnabled={isDragEnabled}
          onView={onView}
          showCitizenName={showCitizenName}
        />
        
        <KanbanColumn
          id="done"
          title={columnTitles.done || 'Done'}
          count={doneComplaints.length}
          complaints={doneComplaints}
          color="#22c55e" // green-500
          isDragEnabled={isDragEnabled}
          onView={onView}
          showCitizenName={showCitizenName}
        />
      </div>
    </DragDropContext>
  );
}
