'use client';

import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { List, Typography, Menu, Dropdown, Modal, Button, Input, Checkbox } from 'antd'; // Added Checkbox
import { Node, Edge, useReactFlow, ReactFlowInstance } from 'reactflow';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';

const { Text } = Typography;

interface TodoListProps {
  nodes: Node[];
  edges: Edge[];
}

// Helper function for topological sort
const getOrderedTasks = (nodes: Node[], edges: Edge[]): Node[] => {
    const sortedList: Node[] = [];
    const nodeMap = new Map(nodes.map(node => [node.id, node]));
    const inDegree = new Map<string, number>();
    const adj = new Map<string, string[]>();

    nodes.forEach(node => {
        inDegree.set(node.id, 0);
        adj.set(node.id, []);
    });

    edges.forEach(edge => {
        if (nodeMap.has(edge.source) && nodeMap.has(edge.target)) {
            adj.get(edge.source)?.push(edge.target);
            inDegree.set(edge.target, (inDegree.get(edge.target) || 0) + 1);
        }
    });

    const queue: string[] = [];
    nodes.forEach(node => {
        if (inDegree.get(node.id) === 0) {
            queue.push(node.id);
        }
    });

    while (queue.length > 0) {
        const u = queue.shift()!;
        const node = nodeMap.get(u);
        if (node) {
            sortedList.push(node);
        }

        adj.get(u)?.forEach(v => {
            const currentInDegree = (inDegree.get(v) || 0) - 1;
            inDegree.set(v, currentInDegree);
            if (currentInDegree === 0) {
                queue.push(v);
            }
        });
    }

    if (sortedList.length !== nodes.length) {
        const remainingNodes = nodes.filter(n => !sortedList.find(sn => sn.id === n.id));
        return [...sortedList, ...remainingNodes];
    }

    return sortedList;
};

// Sortable Item Component
interface SortableItemProps {
  id: string;
  node: Node;
  index: number;
  order?: number;
  onDelete: (node: Node) => void;
  isCompleted: boolean; // Added
  onToggleComplete: (id: string, completed: boolean) => void; // Added
}
function SortableItem({ id, node, index, onDelete, isCompleted, onToggleComplete }: SortableItemProps) { // Added props
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    cursor: 'grab',
    opacity: isDragging ? 0.5 : 1,
    display: 'flex',
    alignItems: 'center',
    padding: '8px 12px',
    borderBottom: '1px solid #f0f0f0',
    backgroundColor: isDragging ? '#e6f7ff' : '#fff',
    justifyContent: 'space-between'
  };

  const displayContent = node.type === 'text' && node.data?.text
    ? node.data.text
    : node.data?.label || `Node ${node.id}`;

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <div style={{ display: 'flex', alignItems: 'center', flexGrow: 1 }}>
        {/* Drag Handle */}
        <span {...listeners} style={{ marginRight: '8px', cursor: 'grab', display: 'inline-flex', alignItems: 'center' }}>
          <GripVertical size={16} />
        </span>
        {/* Checkbox */}
        <Checkbox
          checked={isCompleted}
          onChange={(e) => onToggleComplete(id, e.target.checked)}
          style={{ marginRight: '8px' }}
          // Removed disabled={isCompleted} to allow unchecking
        />
        {/* Task Text */}
        <Text delete={isCompleted} style={{ flexGrow: 1, textDecoration: isCompleted ? 'line-through' : 'none' }}>
          {index + 1}. {displayContent}
        </Text>
      </div>
      <div>
        <Button
          type="text"
          size="small"
          danger
          onClick={() => onDelete(node)}
        >
          删除
        </Button>
      </div>
    </div>
  );
}

const TodoList: React.FC<TodoListProps> = ({ nodes, edges }) => {
  const { setEdges, setNodes, getNode } = useReactFlow(); // Added getNode
  const [taskOrder, setTaskOrder] = useState<string[]>([]);
  const [completedTasks, setCompletedTasks] = useState<Set<string>>(new Set()); // Added state for completed tasks
  const [deleteConfirm, setDeleteConfirm] = useState<Node | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
    edge?: Edge;
  }>({
    visible: false,
    x: 0,
    y: 0
  });

  const nodeMap = useMemo(() => new Map(nodes.map(node => [node.id, node])), [nodes]);

  useEffect(() => {
    if (!nodes || nodes.length === 0) {
      setTaskOrder([]);
      return;
    }
    const initialOrderedNodes = getOrderedTasks(nodes, edges);
    const initialOrderedIds = initialOrderedNodes.map(n => n.id);

    const orderChanged =
      initialOrderedIds.length !== taskOrder.length ||
      initialOrderedIds.some((id, index) => id !== taskOrder[index]);

    if (orderChanged) {
      setTaskOrder(initialOrderedIds);
    }
    // Initialize completedTasks based on node data if needed on initial load or node changes
    const initialCompleted = new Set<string>();
    nodes.forEach(node => {
        if (node.data?.completed) {
            initialCompleted.add(node.id);
        }
    });
    setCompletedTasks(initialCompleted);

  }, [nodes, edges]); // Removed taskOrder from dependency array to avoid loop

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setTaskOrder((items) => {
        const oldIndex = items.indexOf(active.id as string);
        const newIndex = items.indexOf(over.id as string);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  // Handler for toggling task completion
  const handleToggleComplete = useCallback((id: string, completed: boolean) => {
    setCompletedTasks(prev => {
      const newSet = new Set(prev);
      if (completed) {
        newSet.add(id);
      } else {
        // This case might not be reachable if checkbox is disabled when completed,
        // but included for completeness.
        newSet.delete(id);
      }
      return newSet;
    });

    // Update the corresponding node in React Flow
    setNodes(nds => nds.map(node => {
      if (node.id === id) {
        return {
          ...node,
          // Disable interaction for completed nodes
          draggable: !completed,
          selectable: !completed,
          connectable: !completed,
          deletable: !completed, // Prevent deletion via React Flow UI, keep list delete button
          data: {
            ...node.data,
            completed: completed,
          },
          style: {
            ...node.style,
            opacity: completed ? 0.6 : 1, // Visual indication
          }
        };
      }
      return node;
    }));
  }, [setNodes]);


  const handleEdgeRemove = useCallback(() => {
    if (contextMenu.edge) {
      setEdges((eds) => eds.filter((e) => e.id !== contextMenu.edge!.id));
      setContextMenu((prev) => ({ ...prev, visible: false }));
    }
  }, [setEdges, contextMenu.edge]);

  const onEdgeContextMenu = useCallback(
    (event: React.MouseEvent, edge: Edge) => {
      event.preventDefault();
      setContextMenu({
        visible: true,
        x: event.clientX,
        y: event.clientY,
        edge: edge,
      });
    },
    []
  );

  const menuOverlay = (
    <Menu
      items={[
        {
          key: 'remove',
          label: '删除连接',
          onClick: handleEdgeRemove
        },
        {
          key: 'cancel',
          label: '取消',
          onClick: () => setContextMenu((prev) => ({ ...prev, visible: false }))
        }
      ]}
    />
  );

  const { sortedTasks, unsortedTasks } = useMemo(() => {
    const connectedNodes = new Set<string>();
    edges.forEach(edge => {
      connectedNodes.add(edge.source);
      connectedNodes.add(edge.target);
    });

    const sorted = nodes.filter(node => connectedNodes.has(node.id));
    const unsorted = nodes.filter(node => !connectedNodes.has(node.id));
    
    return { sortedTasks: sorted, unsortedTasks: unsorted };
  }, [nodes, edges]);

  if (sortedTasks.length === 0 && unsortedTasks.length === 0) {
    return <div style={{ padding: '16px', color: '#888' }}>Add nodes to the canvas to create tasks.</div>;
  }

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Sorted Tasks Section */}
        <div>
          <h3 style={{ marginBottom: '8px' }}>已排序任务</h3>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={taskOrder}
              strategy={verticalListSortingStrategy}
            >
              <div style={{ border: '1px solid #d9d9d9', borderRadius: '2px' }}>
                {sortedTasks.map((node, index) => (
                  <SortableItem
                    key={node.id}
                    id={node.id}
                    node={node}
                    index={index}
                    onDelete={(node) => setDeleteConfirm(node)}
                    isCompleted={completedTasks.has(node.id)} // Pass completion status
                    onToggleComplete={handleToggleComplete} // Pass handler
                  />
                ))}
                {sortedTasks.length === 0 && (
                  <div style={{ padding: '16px', color: '#888', textAlign: 'center' }}>
                    通过连线来对任务进行排序
                  </div>
                )}
              </div>
            </SortableContext>
          </DndContext>
        </div>

        {/* Unsorted Tasks Section */}
        <div>
          <h3 style={{ marginBottom: '8px' }}>待排序任务</h3>
          <div style={{ border: '1px solid #d9d9d9', borderRadius: '2px' }}>
            {unsortedTasks.map((node) => {
              const isCompleted = completedTasks.has(node.id);
              const displayContent = node.type === 'text' && node.data?.text
                ? node.data.text
                : node.data?.label || `Node ${node.id}`;

              return (
                <div
                  key={node.id}
                  style={{
                    padding: '8px 12px',
                    borderBottom: '1px solid #f0f0f0',
                    background: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', flexGrow: 1 }}>
                    {/* Checkbox for unsorted tasks */}
                    <Checkbox
                      checked={isCompleted}
                      onChange={(e) => handleToggleComplete(node.id, e.target.checked)}
                      style={{ marginRight: '8px' }}
                    />
                    {/* Task Text for unsorted tasks */}
                    <Text delete={isCompleted} style={{ flexGrow: 1, textDecoration: isCompleted ? 'line-through' : 'none' }}>
                      {displayContent}
                    </Text>
                  </div>
                <div>
                  <Button
                    type="text"
                    size="small"
                    danger
                    onClick={() => setDeleteConfirm(node)}
                  >
                    删除
                  </Button>
                </div>
              </div>
             ); // Added closing parenthesis for return
            })} {/* Added closing curly brace for map callback */}
            {unsortedTasks.length === 0 && (
              <div style={{ padding: '16px', color: '#888', textAlign: 'center' }}>
                暂无待排序任务
              </div>
            )}
          </div>
        </div>
      </div>

      {contextMenu.visible && (
        <div
          style={{
            position: 'fixed',
            left: contextMenu.x,
            top: contextMenu.y,
            zIndex: 1000
          }}
          onClick={() => setContextMenu((prev) => ({ ...prev, visible: false }))}
        >
          <Dropdown
            open
            overlay={menuOverlay}
            trigger={[]}
          >
            <div style={{ width: 0, height: 0 }} />
          </Dropdown>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <Modal
        title="确认删除"
        open={!!deleteConfirm}
        onOk={() => {
          if (deleteConfirm) {
            setNodes((nds) => nds.filter((node) => node.id !== deleteConfirm.id));
            setEdges((eds) =>
              eds.filter(
                (edge) =>
                  edge.source !== deleteConfirm.id &&
                  edge.target !== deleteConfirm.id
              )
            );
            // Also remove from completed tasks state if deleted
            setCompletedTasks(prev => {
               const newSet = new Set(prev);
               newSet.delete(deleteConfirm.id);
               return newSet;
            });
            setDeleteConfirm(null);
          }
        }}
        onCancel={() => setDeleteConfirm(null)}
      >
        <p>确定要删除这个任务吗？这个操作无法撤销。</p>
      </Modal>
    </>
  );
};

export default TodoList;