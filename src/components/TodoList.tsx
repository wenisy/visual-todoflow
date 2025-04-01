import React, { useMemo, useState, useEffect } from 'react';
import { List, Typography } from 'antd';
import { Node, Edge, useReactFlow } from 'reactflow';
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
import { GripVertical } from 'lucide-react'; // Using lucide-react for a drag handle icon

const { Text } = Typography;

interface TodoListProps {
  nodes: Node[];
  edges: Edge[];
  // We might need a way to update the order externally if needed, but let's manage internally for now
  // onOrderChange?: (orderedNodeIds: string[]) => void;
}

// Helper function for topological sort (remains the same)
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
        // Ensure source and target exist in the node map before processing edge
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
        console.warn("Cycle detected or graph is disconnected. Todo list might be incomplete or unstable.");
        const remainingNodes = nodes.filter(n => !sortedList.find(sn => sn.id === n.id));
        return [...sortedList, ...remainingNodes];
    }

    return sortedList;
};

// --- Sortable Item Component ---
interface SortableItemProps {
  id: string;
  node: Node;
  index: number;
}

function SortableItem({ id, node, index }: SortableItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging, // Use isDragging for styling
  } = useSortable({ id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    cursor: 'grab', // Indicate draggable
    opacity: isDragging ? 0.5 : 1, // Dim item while dragging
    display: 'flex', // Use flex for layout
    alignItems: 'center', // Align items vertically
    padding: '8px 12px', // Match Ant List Item padding (approx)
    borderBottom: '1px solid #f0f0f0', // Mimic Ant List border
    backgroundColor: isDragging ? '#e6f7ff' : '#fff', // Highlight when dragging
  };

  // Conditional content display
  const displayContent = node.type === 'text' && node.data?.text
    ? node.data.text
    : node.data?.label || `Node ${node.id}`;

  return (
    <div ref={setNodeRef} style={style} {...attributes} >
      {/* Drag Handle */}
      <span {...listeners} style={{ marginRight: '10px', cursor: 'grab', display: 'inline-flex', alignItems: 'center' }}>
        <GripVertical size={16} />
      </span>
      {/* Content */}
      <Text>
        {index + 1}. {displayContent}
      </Text>
    </div>
  );
}


// --- Main TodoList Component ---
const TodoList: React.FC<TodoListProps> = ({ nodes, edges }) => {
  // State to hold the manually sortable list of node IDs
  const [taskOrder, setTaskOrder] = useState<string[]>([]);
  // Memoized map for quick node lookup by ID
  const nodeMap = useMemo(() => new Map(nodes.map(node => [node.id, node])), [nodes]);

  // Effect to initialize or update taskOrder when nodes/edges change
  useEffect(() => {
    if (!nodes || nodes.length === 0) {
      setTaskOrder([]);
      return;
    }
    // Calculate the initial order based on topology
    const initialOrderedNodes = getOrderedTasks(nodes, edges);
    // Update state only if the calculated order differs from the current manual order
    // This prevents resetting manual order on unrelated node/edge changes (e.g., position)
    const initialOrderedIds = initialOrderedNodes.map(n => n.id);
    // Simple length check first for performance
    if (initialOrderedIds.length !== taskOrder.length || initialOrderedIds.some((id, index) => id !== taskOrder[index])) {
         setTaskOrder(initialOrderedIds);
    }
    // Dependency array includes nodes and edges to recalculate initial order
    // taskOrder is included to trigger the comparison logic when it changes externally (if needed)
  }, [nodes, edges, taskOrder]); // Added taskOrder dependency for comparison


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
        // Update the state with the new order
        const newOrder = arrayMove(items, oldIndex, newIndex);
        // Optionally call onOrderChange here if needed
        // if (onOrderChange) {
        //   onOrderChange(newOrder);
        // }
        return newOrder;
      });
    }
  };

  // Get the actual node objects in the current manual order
  const manuallyOrderedTasks = useMemo(() => {
      return taskOrder.map(id => nodeMap.get(id)).filter((node): node is Node => node !== undefined);
  }, [taskOrder, nodeMap]);


  // Separate tasks into connected (sorted) and unconnected (unsorted) groups
  const { setNodes } = useReactFlow();

  // Update nodes with order information and separate into sorted/unsorted
  const { sortedTasks, unsortedTasks } = useMemo(() => {
    const sortedIds = new Set(taskOrder);
    
    // Get nodes with order numbers for sorted tasks
    const sorted = manuallyOrderedTasks.map((node: Node, index: number) => ({
      ...node,
      data: {
        ...node.data,
        order: index, // Add order number to node data
      }
    }));

    // Get unsorted tasks and ensure they don't have order numbers
    const unsorted = nodes.filter(node => !sortedIds.has(node.id)).map((node: Node) => ({
      ...node,
      data: {
        ...node.data,
        order: undefined, // Remove order number from unsorted nodes
      }
    }));

    // Update the nodes in the main ReactFlow state
    setNodes((prevNodes: Node[]) => {
      const nodeMap = new Map(prevNodes.map(n => [n.id, n]));
      sorted.forEach(n => nodeMap.set(n.id, n));
      unsorted.forEach(n => nodeMap.set(n.id, n));
      return Array.from(nodeMap.values());
    });

    return { sortedTasks: sorted, unsortedTasks: unsorted };
  }, [manuallyOrderedTasks, nodes, taskOrder, setNodes]);
  // If no tasks at all, show empty message
  if (sortedTasks.length === 0 && unsortedTasks.length === 0) {
    return <div style={{ padding: '16px', color: '#888' }}>Add nodes to the canvas to create tasks.</div>;
  }

  return (
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
                <SortableItem key={node.id} id={node.id} node={node} index={index} />
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
          {unsortedTasks.map((node) => (
            <div
              key={node.id}
              style={{
                padding: '8px 12px',
                borderBottom: '1px solid #f0f0f0',
                background: '#fff',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <div>{node.data?.label || `Node ${node.id}`}</div>
            </div>
          ))}
          {unsortedTasks.length === 0 && (
            <div style={{ padding: '16px', color: '#888', textAlign: 'center' }}>
              暂无待排序任务
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TodoList;