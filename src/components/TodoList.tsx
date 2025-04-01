'use client';

import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { Typography, Modal, Button, Checkbox } from 'antd';
import { Node, Edge, useReactFlow } from 'reactflow';

const { Text } = Typography;

interface TodoListProps {
  nodes: Node[];
  edges: Edge[];
  onEdgeContextMenu?: (event: React.MouseEvent, edge: Edge) => void;
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


const TodoList: React.FC<TodoListProps> = ({ nodes, edges }) => {
  const { setEdges, setNodes } = useReactFlow();
  const [taskOrder, setTaskOrder] = useState<string[]>([]);
  const [completedTasks, setCompletedTasks] = useState<Set<string>>(new Set()); // Added state for completed tasks
  const [deleteConfirm, setDeleteConfirm] = useState<Node | null>(null);

  const nodeMap = useMemo(() => new Map(nodes.map(node => [node.id, node])), [nodes]);

  // Update taskOrder when edges change
  useEffect(() => {
    // Get all nodes that have connections
    const connectedNodes = new Set<string>();
    edges.forEach(edge => {
      const sourceExists = nodes.some(n => n.id === edge.source);
      const targetExists = nodes.some(n => n.id === edge.target);
      if (sourceExists && targetExists) {
        connectedNodes.add(edge.source);
        connectedNodes.add(edge.target);
      }
    });

    // Get connected nodes in topological order
    const connectedNodesList = nodes.filter(node => connectedNodes.has(node.id));
    const orderedNodes = getOrderedTasks(connectedNodesList, edges);
    const newOrder = orderedNodes.map(n => n.id);

    // Update taskOrder if it has changed
    setTaskOrder(newOrder);

    // Update completed tasks
    const initialCompleted = new Set<string>();
    nodes.forEach(node => {
      if (node.data?.completed) {
        initialCompleted.add(node.id);
      }
    });
    setCompletedTasks(initialCompleted);
  }, [nodes, edges]);

  // Effect to remove disconnected nodes from taskOrder
  useEffect(() => {
    // Find nodes that should be removed from taskOrder
    // A node should be removed if it has no active connections
    const connectedNodes = new Set<string>();
    edges.forEach(edge => {
      const sourceExists = nodes.some(n => n.id === edge.source);
      const targetExists = nodes.some(n => n.id === edge.target);
      if (sourceExists && targetExists) {
        connectedNodes.add(edge.source);
        connectedNodes.add(edge.target);
      }
    });

    // Filter out nodes that are no longer connected
    setTaskOrder(current =>
      current.filter(nodeId => connectedNodes.has(nodeId))
    );
  }, [edges, nodes]);


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



  // Use taskOrder to determine sorted and unsorted tasks
  const unsortedTasks = useMemo(() => {
    const taskOrderSet = new Set(taskOrder);
    return nodes.filter(node => !taskOrderSet.has(node.id));
  }, [nodes, taskOrder]);

  if (taskOrder.length === 0 && unsortedTasks.length === 0) {
    return <div style={{ padding: '16px', color: '#888' }}>Add nodes to the canvas to create tasks.</div>;
  }

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Sorted Tasks Section */}
        <div>
          <h3 style={{ marginBottom: '8px' }}>已排序任务</h3>
          <div style={{ border: '1px solid #d9d9d9', borderRadius: '2px' }}>
                {taskOrder.map((nodeId, index) => {
                  const node = nodeMap.get(nodeId);
                  if (!node) return null;
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
                        backgroundColor: '#fff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', flexGrow: 1 }}>
                        {/* Checkbox */}
                        <Checkbox
                          checked={isCompleted}
                          onChange={(e) => handleToggleComplete(node.id, e.target.checked)}
                          style={{ marginRight: '8px' }}
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
                          onClick={() => setDeleteConfirm(node)}
                        >
                          删除
                        </Button>
                      </div>
                    </div>
                  );
                })}
                {taskOrder.length === 0 && (
                  <div style={{ padding: '16px', color: '#888', textAlign: 'center' }}>
                    通过连线来对任务进行排序
                  </div>
                )}
              </div> {/* Closing div for the sorted list container */}
        </div> {/* Closing div for the sorted tasks section */}

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
             );
            })}
            {unsortedTasks.length === 0 && (
              <div style={{ padding: '16px', color: '#888', textAlign: 'center' }}>
                暂无待排序任务
              </div>
            )}
          </div>
        </div>
      </div>


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