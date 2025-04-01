'use client';

import React, { useState, useCallback, useRef, DragEvent, useMemo, MouseEvent, useEffect } from 'react';
import { Layout, Button, Space, Dropdown, MenuProps, message, Modal, List, Input, App } from 'antd';
import type { MenuInfo } from 'rc-menu/lib/interface'; // Import MenuInfo type
import { SaveOutlined, FileTextOutlined, PictureOutlined, PaperClipOutlined, ShareAltOutlined, PlusOutlined, CopyOutlined, ScissorOutlined, DeleteOutlined, DisconnectOutlined } from '@ant-design/icons';
import ReactFlow, {
  Controls,
  Background,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  Node,
  Edge,
  NodeChange,
  EdgeChange,
  Connection,
  MiniMap,
  ReactFlowProvider,
  XYPosition,
  NodeTypes,
  ReactFlowInstance,
  MarkerType, // Import MarkerType for edge arrowheads
} from 'reactflow';

import 'reactflow/dist/style.css';
import './globals.css';

// Import Custom Nodes
import TextNode from '@/components/nodes/TextNode';
import ImageNode from '@/components/nodes/ImageNode';
import AttachmentNode from '@/components/nodes/AttachmentNode';
import SocialNode from '@/components/nodes/SocialNode';
import TodoList from '@/components/TodoList'; // Import TodoList component

const { Header, Sider, Content } = Layout; // Ant Design Layout components

// --- Styles ---
// ... (styles remain the same)
const headerStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  backgroundColor: '#fff',
  borderBottom: '1px solid #f0f0f0',
  padding: '0 24px',
  height: 64,
};

const siderStyle: React.CSSProperties = {
  backgroundColor: '#fff',
  padding: '16px',
  borderRight: '1px solid #f0f0f0',
  display: 'flex',
  flexDirection: 'column',
};

// Adjust content wrapper style if needed, maybe remove width: 100% if Sider takes space
const contentWrapperStyle: React.CSSProperties = {
  position: 'relative',
  padding: 0,
  margin: 0,
  backgroundColor: '#f0f2f5',
  height: 'calc(100vh - 64px)',
  // width: '100%', // Let Layout handle width distribution
};

const rightSiderStyle: React.CSSProperties = {
  backgroundColor: '#fff',
  padding: '16px',
  borderLeft: '1px solid #f0f0f0', // Border on the left
  height: 'calc(100vh - 64px)', // Match content height
  overflowY: 'auto', // Add scroll if list is long
};

const layoutStyle: React.CSSProperties = {
  minHeight: '100vh',
};


// Helper function to generate UUID
const generateUuid = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

// --- Initial Data & ID Generation ---
const initialNodes: Node[] = [];
const initialEdges: Edge[] = [];

// Initialize ID counter
let id = 1;

// --- Draggable Sidebar Item ---
// ... (DraggableItem component remains the same)
interface DraggableItemProps {
  nodeType: string;
  label: string;
  icon: React.ReactNode;
}

const DraggableItem: React.FC<DraggableItemProps> = ({ nodeType, label, icon }) => {
  const onDragStart = (event: DragEvent<HTMLDivElement>, type: string) => {
    event.dataTransfer.setData('application/reactflow', type);
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div
      style={{
        padding: '8px 12px',
        marginBottom: '8px',
        border: '1px solid #eee',
        borderRadius: '4px',
        display: 'flex',
        alignItems: 'center',
        cursor: 'grab',
        backgroundColor: '#fafafa',
      }}
      onDragStart={(event) => onDragStart(event, nodeType)}
      draggable
    >
      {icon}&nbsp; {label}
    </div>
  );
};


// --- Main Flow Component ---
const FlowEditor: React.FC = () => {
  const { modal } = App.useApp();
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [nodes, setNodes] = useState<Node[]>(initialNodes);
  const [edges, setEdges] = useState<Edge[]>(initialEdges);
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [flowcharts, setFlowcharts] = useState<Array<{ tag: string; uuid: string }>>([]);
  const [isSaving, setIsSaving] = useState(false); // State for save button loading
  const [isLoading, setIsLoading] = useState(false); // State for load button loading
  const [hoveredEdgeId, setHoveredEdgeId] = useState<string | null>(null); // State for hovered edge
  const [currentTag, setCurrentTag] = useState<string>("未命名"); // State for current tag
  const [currentUuid, setCurrentUuid] = useState<string>(generateUuid()); // Initialize with UUID for new canvas

  // Define loadFlowchart outside of onClick
  // Helper function to generate UUID

  const loadFlowchart = useCallback(async (uuid: string) => {
    console.log('loadFlowchart called for uuid:', uuid);
    setIsLoading(true);
    try {
      const response = await fetch('/api/notion/load', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ uuid }),
      });

      if (!response.ok) {
        throw new Error('Failed to load flowchart');
      }

      const data = await response.json();
      setNodes(data.nodes || []);
      setEdges(data.edges || []);
      setCurrentTag(data.tag);
      setCurrentUuid(data.uuid);
      setHasUnsavedChanges(false);
    } catch (error) {
      console.error('Failed to load flowchart:', error);
      message.error('Failed to load flowchart');
    } finally {
      console.log('loadFlowchart completed');
      setIsLoading(false);
    }
  }, [setNodes, setEdges, setCurrentTag]);
  const [isTagModalVisible, setIsTagModalVisible] = useState(false);
  const [tagInputValue, setTagInputValue] = useState('');

  // State for pane context menu
  const [menu, setMenu] = useState<{ x: number; y: number; show: boolean }>({ x: 0, y: 0, show: false });
  // State for node context menu
  const [nodeMenu, setNodeMenu] = useState<{ x: number; y: number; show: boolean; nodeId: string | null }>({ x: 0, y: 0, show: false, nodeId: null });
  // State for clipboard (for copy/paste)
  const [clipboard, setClipboard] = useState<{ node: Node | null; type: 'copy' | 'cut' | null }>({ node: null, type: null });
  const nodeTypes: NodeTypes = useMemo(() => ({
    text: TextNode,
    image: ImageNode,
    attachment: AttachmentNode,
    social: SocialNode,
  }), []);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => setNodes((nds) => applyNodeChanges(changes, nds)),
    [setNodes]
  );
  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => setEdges((eds) => applyEdgeChanges(changes, eds)),
    [setEdges]
  );
  const onConnect = useCallback(
    (connection: Connection) => {
      // Add standard arrowhead to new connections
      const newEdge = {
        ...connection,
        markerEnd: {
          type: MarkerType.ArrowClosed,
          width: 20,
          height: 20,
          color: '#B1B1B7', // Default arrow color
        },
        style: {
          strokeWidth: 2, // Default stroke width
          stroke: '#B1B1B7', // Default stroke color
        },
      };
      setEdges((eds) => addEdge(newEdge, eds));
    },
    [setEdges]
  );

  // --- Edge Hover Handlers ---
  const onEdgeMouseEnter = useCallback((event: React.MouseEvent, edge: Edge) => {
    setHoveredEdgeId(edge.id);
  }, [setHoveredEdgeId]);

  const onEdgeMouseLeave = useCallback(() => {
    setHoveredEdgeId(null);
  }, [setHoveredEdgeId]);

  const onDragOver = useCallback((event: DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  // Function to add a node at a specific position
  // ID generation function with collision prevention
  const getId = useCallback(() => {
    // Find the maximum numeric ID from existing nodes
    const maxId = nodes.reduce((max: number, node: Node) => {
      const numId = parseInt(node.id);
      return !isNaN(numId) ? Math.max(max, numId) : max;
    }, 0);
    
    // Set the counter to max + 1 if it's lower
    if (id <= maxId) {
      id = maxId + 1;
    }
    
    return `${id++}`;
  }, [nodes]);

  const addNode = useCallback((type: string, position: XYPosition) => {
    interface NodeData {
      label: string;
      text?: string;
      imageUrl?: string;
      fileName?: string;
      fileUrl?: string;
      url?: string;
    }
    
    let nodeData: NodeData = {
      label: `${type} node`
    };
    
    switch (type) { // Initialize data properties for each type
      case 'text': nodeData = { label: 'Text Input', text: '' }; break; // Add text: ''
      case 'image': nodeData = { label: 'Image Upload', imageUrl: undefined }; break; // Add imageUrl
      case 'attachment': nodeData = { label: 'File Attachment', fileName: undefined, fileUrl: undefined }; break; // Add fileName/fileUrl
      case 'social': nodeData = { label: 'Social Post Link', url: '' }; break; // Add url
      default: nodeData = { label: `${type} node` };
    }

    const newNode: Node = {
      id: getId(),
      type,
      position,
      data: nodeData,
    };
    setNodes((nds) => nds.concat(newNode));
  }, [setNodes, getId]); // Added getId dependency


  const onDrop = useCallback(
    (event: DragEvent) => {
      event.preventDefault();
      setMenu({ show: false, x: 0, y: 0 }); // Hide menu on drop

      if (!reactFlowWrapper.current || !reactFlowInstance) { // Check instance
        return;
      }

      const type = event.dataTransfer.getData('application/reactflow');
      if (typeof type === 'undefined' || !type) return;

      const position = reactFlowInstance.screenToFlowPosition({ // Use instance method
        x: event.clientX,
        y: event.clientY,
      });
      addNode(type, position); // Use the addNode function
    },
    [reactFlowInstance, addNode] // Updated dependencies
  );

  // --- Context Menu Logic ---
  const onPaneContextMenu = useCallback(
    (event: MouseEvent) => {
      event.preventDefault(); // Prevent native context menu
      // Set state immediately, let Dropdown handle positioning
      setMenu({
        x: event.clientX, // Store coords, might be useful later but not for positioning now
        y: event.clientY,
        show: true,
      });
    },
    [setMenu]
  );

  // Handle PANE context menu item clicks (Add Node, Paste)
  const handleMenuClick: MenuProps['onClick'] = useCallback(
    (e: MenuInfo) => {
      if (!reactFlowInstance) return;

      const position = reactFlowInstance.screenToFlowPosition({
        x: menu.x, // Use stored coordinates from pane menu state
        y: menu.y,
      });

      if (e.key === 'paste') {
        if (clipboard.node) {
          // Create a new node from the clipboard data at the clicked position
          const newNode: Node = {
            ...clipboard.node,
            id: getId(), // Generate a new ID
            position, // Place it where the user right-clicked
            selected: false, // Ensure it's not selected initially
          };
          setNodes((nds) => nds.concat(newNode));

          // If it was a 'cut' operation, clear the clipboard
          if (clipboard.type === 'cut') {
            setClipboard({ node: null, type: null });
          }
        } else {
          message.info('Clipboard is empty.');
        }
      } else {
        // Add a new node based on the key (text, image, etc.)
        addNode(e.key, position);
      }

      setMenu({ show: false, x: 0, y: 0 }); // Hide pane menu
    },
    [addNode, menu.x, menu.y, reactFlowInstance, clipboard, setNodes, setClipboard] // Added clipboard dependencies
  );


  // --- Node Context Menu Logic ---
  const onNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: Node) => {
      event.preventDefault(); // Prevent native context menu
      setMenu({ show: false, x: 0, y: 0 }); // Hide pane menu if open
      // Set state immediately, let Dropdown handle positioning
      setNodeMenu({
        x: event.clientX, // Store coords
        y: event.clientY,
        show: true,
        nodeId: node.id,
      });
    },
    [setNodeMenu, setMenu]
  );

  // Hide node menu on pane click or drag
  const onPaneClickOrDrag = useCallback(() => {
    setMenu({ show: false, x: 0, y: 0 });
    setNodeMenu({ show: false, x: 0, y: 0, nodeId: null });
  }, [setMenu, setNodeMenu]);


  // Handle NODE context menu item clicks (Copy, Cut, Delete)
  const handleNodeMenuClick: MenuProps['onClick'] = useCallback(
    (e: MenuInfo) => {
      const targetNodeId = nodeMenu.nodeId;
      if (!targetNodeId) return;

      const targetNode = nodes.find(n => n.id === targetNodeId);
      if (!targetNode) return;

      switch (e.key) {
        case 'copy':
          setClipboard({ node: { ...targetNode }, type: 'copy' }); // Store a copy
          message.success(`Node "${targetNode.data.label || targetNode.id}" copied.`);
          break;
        case 'cut':
          setClipboard({ node: { ...targetNode }, type: 'cut' }); // Store a copy for pasting
          // Remove the node and connected edges
          setNodes((nds) => nds.filter((n) => n.id !== targetNodeId));
          setEdges((eds) => eds.filter((edge) => edge.source !== targetNodeId && edge.target !== targetNodeId));
          message.success(`Node "${targetNode.data.label || targetNode.id}" cut.`);
          break;
        case 'break-sort':
          // Remove all edges connected to the node, making it an unsorted task
          setEdges((eds) => eds.filter((edge) => edge.source !== targetNodeId && edge.target !== targetNodeId));
          message.success(`Node "${targetNode.data.label || targetNode.id}" moved to unsorted tasks.`);
          break;
        case 'delete':
          // Remove the node and connected edges
          setNodes((nds) => nds.filter((n) => n.id !== targetNodeId));
          setEdges((eds) => eds.filter((edge) => edge.source !== targetNodeId && edge.target !== targetNodeId));
          message.success(`Node "${targetNode.data.label || targetNode.id}" deleted.`);
          break;
      }

      setNodeMenu({ show: false, x: 0, y: 0, nodeId: null }); // Hide node menu
    },
    [nodeMenu.nodeId, nodes, setNodes, setEdges, setClipboard] // Added dependencies
  );

  // Define PANE menu items
  const contextMenuItems: MenuProps['items'] = useMemo(() => [
    { key: 'text', label: 'Add Text Node', icon: <FileTextOutlined /> },
    { key: 'image', label: 'Add Image Node', icon: <PictureOutlined /> },
    { key: 'attachment', label: 'Add Attachment Node', icon: <PaperClipOutlined /> },
    { key: 'social', label: 'Add Social Node', icon: <ShareAltOutlined /> },
    { type: 'divider' },
    { key: 'paste', label: 'Paste Node', icon: <PlusOutlined />, disabled: !clipboard.node }, // Use Plus icon for Paste, disable if clipboard empty
  ], [clipboard.node]); // Recompute when clipboard changes


  // Define NODE menu items
  const nodeContextMenuItems: MenuProps['items'] = [
    { key: 'copy', label: 'Copy Node', icon: <CopyOutlined /> },
    { key: 'cut', label: 'Cut Node', icon: <ScissorOutlined /> },
    { key: 'break-sort', label: '脱离排序', icon: <DisconnectOutlined /> },
    { key: 'delete', label: 'Delete Node', icon: <DeleteOutlined />, danger: true },
  ];


  // Fetch tags when component mounts
  useEffect(() => {
    const fetchFlowcharts = async () => {
      try {
        const response = await fetch('/api/notion/list-tags');
        const data = await response.json();
        if (data.flowcharts) {
          setFlowcharts(data.flowcharts);
        }
      } catch (error) {
        console.error('Failed to fetch flowcharts:', error);
        message.error('Failed to fetch saved flowcharts');
      }
    };
    fetchFlowcharts();
  }, []);

  // Update hasUnsavedChanges when nodes or edges change
  useEffect(() => {
    setHasUnsavedChanges(true);
  }, [nodes, edges]);

  // Function to actually perform the save operation with a tag
  const confirmSave = async (tag: string) => {
    if (!tag) {
      message.error('Tag name cannot be empty.');
      return;
    }
    if (!reactFlowInstance) {
      message.error('Flow instance not ready.');
      return;
    }
    const currentNodes = nodes;
    const currentEdges = edges;
    if (!currentNodes || currentNodes.length === 0) {
      message.warning('Canvas is empty, nothing to save.');
      return;
    }

    setIsSaving(true);
    setIsTagModalVisible(false); // Close modal before saving
    message.loading({ content: `Saving with tag "${tag}"...`, key: 'save_notion', duration: 0 });

    try {
      const uuid = currentUuid || generateUuid();
      const response = await fetch('/api/notion/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          nodes: currentNodes,
          edges: currentEdges,
          tag, // Use the provided tag
          uuid
        }),
      });
      
      // Update UUID if it was newly generated
      if (!currentUuid) {
        setCurrentUuid(uuid);
      }

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || `HTTP error! status: ${response.status}`);
      }
      message.success({ content: result.message || 'Saved successfully!', key: 'save_notion', duration: 3 }); // Duration 3s
      setHasUnsavedChanges(false);

      // Refresh tags list
      const flowchartsResponse = await fetch('/api/notion/list-tags');
      const flowchartsData = await flowchartsResponse.json();
      if (flowchartsData.flowcharts) {
        setFlowcharts(flowchartsData.flowcharts);
      }


    } catch (error) {
      console.error('Failed to save:', error);
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      message.error({ content: `Save failed: ${errorMessage}`, key: 'save_notion', duration: 3 }); // Duration 3s
    } finally {
      setIsSaving(false);
      setTagInputValue(''); // Clear input value after attempt
    }
  };

  // Modified handleSave to just open the modal
  const handleSave = () => {
    if (!nodes || nodes.length === 0) {
      message.warning('Canvas is empty, nothing to save.');
      return;
    }
    // Use current tag as default value
    setTagInputValue(currentTag);
    setIsTagModalVisible(true);
  };

  return (
    <> {/* Use Fragment to wrap Layout and Modal */}
      <Layout style={layoutStyle}>
        <Header style={headerStyle}>
          <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>Visual TodoFlow</div>
          <Input
            style={{ fontSize: '1.2rem', color: '#1677ff', width: '200px', textAlign: 'center' }}
            value={currentTag || "未命名"}
            onChange={(e) => setCurrentTag(e.target.value)}
            onPressEnter={(e) => {
              const newTag = e.currentTarget.value;
              if (newTag) {
                setCurrentTag(newTag);
              }
            }}
          />
          <Space>
            <Button
              type="primary"
              icon={<SaveOutlined />}
              onClick={handleSave}
              loading={isSaving}
            >
              Save
            </Button>
            <Button
              icon={<PlusOutlined />}
              onClick={() => {
                if (hasUnsavedChanges) {
                  modal.confirm({
                    title: '未保存的更改',
                    content: '当前的更改尚未保存，是否继续新建？',
                    okText: '继续',
                    cancelText: '取消',
                    onOk: () => {
                      setNodes([]);
                      setEdges([]);
                      setCurrentTag("未命名");
                      setCurrentUuid(generateUuid());
                      setHasUnsavedChanges(false);
                    }
                  });
                } else {
                  setNodes([]);
                  setEdges([]);
                  setCurrentTag("未命名");
                  setCurrentUuid(generateUuid());
                }
              }}
            >
              新建
            </Button>
          </Space>
        </Header>
        <Layout>
          <Sider width={250} style={siderStyle}>
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              <div>
                <h3 style={{ marginBottom: '16px' }}>Components</h3>
                <DraggableItem nodeType="text" label="Text" icon={<FileTextOutlined />} />
                <DraggableItem nodeType="image" label="Image" icon={<PictureOutlined />} />
                <DraggableItem nodeType="attachment" label="Attachment" icon={<PaperClipOutlined />} />
                <DraggableItem nodeType="social" label="Social Post" icon={<ShareAltOutlined />} />
              </div>

              <div style={{ marginTop: '32px' }}>
                <h3 style={{ marginBottom: '16px' }}>Saved Flowcharts</h3>
                <div style={{
                  maxHeight: '200px',
                  overflowY: 'auto',
                  border: '1px solid #f0f0f0',
                  borderRadius: '4px'
                }}>
                  {flowcharts.length > 0 ? (
                    <List
                      size="small"
                      dataSource={flowcharts}
                      renderItem={(flowchart) => (
                        <List.Item
                          style={{
                            padding: '8px 12px',
                            cursor: 'pointer',
                            backgroundColor: currentUuid === flowchart.uuid ? '#e6f4ff' : undefined,
                            color: currentUuid === flowchart.uuid ? '#1677ff' : undefined
                          }}
                          onClick={() => {
                            if (hasUnsavedChanges) {
                              modal.confirm({
                                title: '未保存的更改',
                                content: '当前的更改尚未保存，是否继续加载？',
                                okText: '继续',
                                cancelText: '取消',
                                onOk: () => loadFlowchart(flowchart.uuid)
                              });
                            } else {
                              loadFlowchart(flowchart.uuid);
                            }
                          }}
                        >
                          {isLoading && currentUuid === flowchart.uuid
                            ? `${flowchart.tag} (loading...)`
                            : flowchart.tag}
                        </List.Item>
                      )}
                    />
                  ) : (
                    <div style={{ padding: '16px', color: '#888', textAlign: 'center' }}>
                      No saved flowcharts
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div style={{ marginTop: 'auto', paddingTop: '16px', borderTop: '1px solid #f0f0f0', fontSize: '0.8rem', color: '#888' }}>
              Drag components onto the canvas. Connect them to define the flow. Right-click canvas to add nodes.
            </div>
          </Sider>
          {/* Main Content Area (Canvas) */}
          <Content style={contentWrapperStyle} ref={reactFlowWrapper} >
            {/* Context Menu Dropdown wrapping the canvas area */}
            {/* Pane Context Menu Dropdown */}
            <Dropdown
              menu={{ items: contextMenuItems, onClick: handleMenuClick }}
              trigger={['contextMenu']}
              open={menu.show}
              onOpenChange={(visible) => !visible && setMenu({ show: false, x: 0, y: 0 })}
            // Remove dropdownRender to let Antd handle positioning
            >
              {/* Node Context Menu Dropdown (nested inside the pane one for positioning context, but triggered separately) */}
              <Dropdown
                menu={{ items: nodeContextMenuItems, onClick: handleNodeMenuClick }}
                trigger={['contextMenu']} // This trigger is handled by onNodeContextMenu preventing default
                open={nodeMenu.show}
                onOpenChange={(visible) => !visible && setNodeMenu({ show: false, x: 0, y: 0, nodeId: null })}
              // Remove dropdownRender to let Antd handle positioning
              >
                {/* This div captures the pane context menu trigger */}
                <div
                  style={{ width: '100%', height: '100%', position: 'relative' }}
                // We need to ensure the pane context menu still triggers the outer Dropdown
                // The inner Dropdown for nodes is triggered by onNodeContextMenu on the ReactFlow component
                >
                  <ReactFlow
                    nodes={nodes}
                    // Dynamically adjust edge styles based on hover state
                    edges={edges.map(edge => {
                      const isHovered = edge.id === hoveredEdgeId;
                      const defaultMarker = { type: MarkerType.ArrowClosed, width: 20, height: 20, color: '#B1B1B7' };
                      const highlightedMarker = { ...defaultMarker, color: '#1677ff' }; // Create highlighted version

                      return {
                        ...edge,
                        style: {
                          ...(edge.style || {}), // Ensure style object exists
                          strokeWidth: isHovered ? 3 : 2,
                          stroke: isHovered ? '#1677ff' : '#B1B1B7',
                        },
                        markerEnd: isHovered ? highlightedMarker : defaultMarker, // Assign the correct marker object
                        // animated: isHovered, // Optional: make it animated only when hovered
                      };
                    })}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    onConnect={onConnect}
                    onEdgeMouseEnter={onEdgeMouseEnter} // Add hover handlers
                    onEdgeMouseLeave={onEdgeMouseLeave}
                    nodeTypes={nodeTypes}
                    onPaneClick={onPaneClickOrDrag} // Use combined handler
                    onPaneContextMenu={onPaneContextMenu}
                    onNodeContextMenu={onNodeContextMenu} // Add node context menu handler
                    onMoveStart={onPaneClickOrDrag} // Hide menus when dragging starts
                    onDrop={onDrop}
                    onDragOver={onDragOver}
                    onInit={setReactFlowInstance}
                    fitView
                    style={{ width: '100%', height: '100%' }}
                  >
                    <Controls />
                    <MiniMap />
                    <Background gap={12} size={1} />
                  </ReactFlow>
                </div>
              </Dropdown>
            </Dropdown>
          </Content>

          {/* Right Sidebar for Todo List */}
          <Sider width={300} style={rightSiderStyle} className="todo-list-sider"> {/* Added className for potential styling */}
            <h3 style={{ marginBottom: '16px' }}>Todo List (Order)</h3>
            {/* Render the TodoList component */}
            {/* <div>Generated list will appear here...</div> */}
            <TodoList nodes={nodes} edges={edges} />
          </Sider>
        </Layout>

        {/* Tag Input Modal */}
        <Modal
          title="Enter Tag Name"
          open={isTagModalVisible}
          onOk={() => confirmSave(tagInputValue)}
          onCancel={() => {
            setIsTagModalVisible(false);
            setTagInputValue(''); // Clear input on cancel
          }}
          confirmLoading={isSaving}
          okText="Save"
          cancelText="Cancel"
        >
          <Input
            placeholder="Enter a tag name (e.g., project-alpha-v1)"
            value={tagInputValue}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTagInputValue(e.target.value)}
            onPressEnter={() => confirmSave(tagInputValue)} // Allow saving with Enter key
          />
        </Modal>
      </Layout>
    </> // Close Fragment
  );
}

// Wrap main export in ReactFlowProvider and App for Modal context
export default function Home() {
  return (
    <App>
      <ReactFlowProvider>
        <FlowEditor />
      </ReactFlowProvider>
    </App>
  );
}
