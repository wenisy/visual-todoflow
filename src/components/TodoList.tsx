import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { List, Typography } from 'antd';
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
  index: number; // Original index in the sorted list for display
  order?: number; // Optional order number to pass down if needed (we might not need it here anymore)
}

// Accept the order prop, even if we don't use it directly in SortableItem itself
function SortableItem({ id, node, index, order }: SortableItemProps) {
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
    console.log('useEffect running with nodes:', nodes?.length, 'edges:', edges?.length);
    
    if (!nodes || nodes.length === 0) {
      console.log('No nodes, resetting taskOrder');
      setTaskOrder([]);
      return;
    }

    const initialOrderedNodes = getOrderedTasks(nodes, edges);
    const initialOrderedIds = initialOrderedNodes.map(n => n.id);
    console.log('Current taskOrder:', taskOrder);
    console.log('Calculated initialOrderedIds:', initialOrderedIds);

    // Compare current and new order
    const orderChanged =
      initialOrderedIds.length !== taskOrder.length ||
      initialOrderedIds.some((id, index) => id !== taskOrder[index]);

    if (orderChanged) {
      console.log('Order changed, updating taskOrder');
      setTaskOrder(initialOrderedIds);
    } else {
      console.log('Order unchanged, skipping update');
    }
  }, [nodes, edges]); // Removed taskOrder from dependencies


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


  // Calculate sorted and unsorted tasks WITHOUT modifying node data
  const { sortedTasks, unsortedTasks } = useMemo(() => {
    const sortedIds = new Set(taskOrder);
    // Find the nodes corresponding to the current manual order
    const sorted = taskOrder
      .map(id => nodeMap.get(id))
      .filter((node): node is Node => node !== undefined);
    // Find nodes not in the manual order
    const unsorted = nodes.filter(node => !sortedIds.has(node.id));
    return { sortedTasks: sorted, unsortedTasks: unsorted };
  }, [taskOrder, nodeMap, nodes]); // Use taskOrder and nodeMap
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
              {/* Pass the index directly as the order prop to SortableItem */}
              {sortedTasks.map((node, index) => (
                // Pass the index as the 'order' prop
                <SortableItem key={node.id} id={node.id} node={node} index={index} order={index} />
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
              {/* Display content for unsorted items */}
              <Text>
                {node.type === 'text' && node.data?.text
                  ? node.data.text
                  : node.data?.label || `Node ${node.id}`}
              </Text>
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