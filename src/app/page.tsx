'use client';

import React, { useState, useCallback, useRef, DragEvent, useMemo, MouseEvent, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Layout, Button, Space, Dropdown, MenuProps, Modal, List, Input, message } from 'antd';
import { LogoutOutlined, SaveOutlined, FileTextOutlined, PictureOutlined, PaperClipOutlined, ShareAltOutlined, PlusOutlined, CopyOutlined, ScissorOutlined, DeleteOutlined, DisconnectOutlined, CloseCircleOutlined } from '@ant-design/icons';
import type { MenuInfo } from 'rc-menu/lib/interface';
import { useAuth } from '@/hooks/useAuth';
import LoginModal from '@/components/LoginModal';
import { API_ENDPOINTS, getAuthHeaders } from '@/config/api';
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
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
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
// --- Local Storage Helpers ---
const LOCAL_STORAGE_PREFIX = 'visual-todoflow:';

const saveToLocalStorage = (uuid: string, data: { nodes: Node[], edges: Edge[], tag: string }) => {
  if (!uuid) return; // Don't save if UUID is missing
  try {
    const dataToStore = {
      ...data,
      savedAt: Date.now() // Add timestamp
    };
    localStorage.setItem(`${LOCAL_STORAGE_PREFIX}${uuid}`, JSON.stringify(dataToStore));
    // console.log(`Saved to LS: ${uuid}`);
  } catch (error) {
    console.error("Failed to save to local storage:", error);
    // Optionally, inform the user or implement more robust error handling
  }
};

const loadFromLocalStorage = (uuid: string): { nodes: Node[], edges: Edge[], tag: string, savedAt?: number } | null => {
  if (!uuid) return null;
  try {
    const item = localStorage.getItem(`${LOCAL_STORAGE_PREFIX}${uuid}`);
    // console.log(`Attempted load from LS: ${uuid}, Found: ${!!item}`);
    if (!item) return null;
    const parsedData = JSON.parse(item);
    // Basic check if it looks like our data (can be improved)
    // Check for timestamp existence as part of validation now
    if (parsedData && typeof parsedData === 'object' && ('nodes' in parsedData || 'edges' in parsedData) && 'savedAt' in parsedData) {
      return parsedData;
    }
    // If data is invalid or old format without timestamp, treat as null and remove
    console.warn("Invalid or old format data found in local storage for:", uuid);
    localStorage.removeItem(`${LOCAL_STORAGE_PREFIX}${uuid}`);
    return null;

  } catch (error) {
    console.error("Failed to load from local storage:", error);
    localStorage.removeItem(`${LOCAL_STORAGE_PREFIX}${uuid}`); // Clear corrupted item
    return null;
  }
};

const clearFromLocalStorage = (uuid: string) => {
  if (!uuid) return;
  try {
    localStorage.removeItem(`${LOCAL_STORAGE_PREFIX}${uuid}`);
    // console.log(`Cleared from LS: ${uuid}`);
  } catch (error) {
    console.error("Failed to clear from local storage:", error);
  }
};

// --- Local Storage Cleanup ---
const CLEANUP_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds

const cleanupLocalStorage = () => {
  const now = Date.now();
  let itemsRemoved = 0;
  try {
    // Iterate safely over keys
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(LOCAL_STORAGE_PREFIX)) {
        const item = localStorage.getItem(key);
        if (item) {
          try {
            const parsedData = JSON.parse(item);
            // Check if it has a timestamp and if it's older than the interval
            if (parsedData.savedAt && (now - parsedData.savedAt > CLEANUP_INTERVAL_MS)) {
              keysToRemove.push(key);
            } else if (!parsedData.savedAt) {
              // Also remove items without a timestamp (old format)
              console.log(`Removing old format LS item (no timestamp): ${key}`);
              keysToRemove.push(key);
            }
          } catch (parseError) {
            // If parsing fails, it might be corrupted, remove it
            console.warn(`Removing potentially corrupted LS item: ${key}`, parseError);
            keysToRemove.push(key);
          }
        } else {
          // If key exists but item is null/undefined somehow, mark for removal
          keysToRemove.push(key);
        }
      }
    }

    // Remove identified keys
    keysToRemove.forEach(key => {
      localStorage.removeItem(key);
      itemsRemoved++;
    });

    if (itemsRemoved > 0) {
      console.log(`Local storage cleanup removed ${itemsRemoved} old or invalid item(s).`);
    }
  } catch (error) {
    console.error("Error during local storage cleanup:", error);
  }
};


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
interface FlowEditorProps {
  searchParams: ReturnType<typeof useSearchParams>;
}

const FlowEditor: React.FC<FlowEditorProps> = ({ searchParams }) => {
  const { isAuthenticated, login, logout, checkTokenValidity } = useAuth(); // Import checkTokenValidity
  const [showLoginModal, setShowLoginModal] = useState(false); // Initialize to false
  const router = useRouter();

  // 使用 useMessage 钩子创建消息 API 和上下文持有者
  const [messageApi, contextHolder] = message.useMessage();
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [nodes, setNodes] = useState<Node[]>(initialNodes);
  const [edges, setEdges] = useState<Edge[]>(initialEdges);
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [flowcharts, setFlowcharts] = useState<Array<{ tag: string; uuid: string; created_time: string }>>([]);
  const [filterText, setFilterText] = useState(''); // State for filter input
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [hoveredEdgeId, setHoveredEdgeId] = useState<string | null>(null);
  const [currentTag, setCurrentTag] = useState<string>("未命名");
  const [currentUuid, setCurrentUuid] = useState<string>(generateUuid());
  const [flowchartToDelete, setFlowchartToDelete] = useState<{ uuid: string; tag: string } | null>(null); // State for delete confirmation

  // 移除未使用的fetchListTags函数

  // Load unsaved changes from localStorage on mount
  useEffect(() => {
    const unsavedData = localStorage.getItem(`${LOCAL_STORAGE_PREFIX}new`);
    if (unsavedData) {
      try {
        const { nodes: savedNodes, edges: savedEdges, tag } = JSON.parse(unsavedData);
        setNodes(savedNodes);
        setEdges(savedEdges);
        setCurrentTag(tag);
        setHasUnsavedChanges(true);
      } catch (error) {
        console.error("Failed to load unsaved changes:", error);
      }
    }
  }, []);

  // Save to localStorage whenever nodes/edges change
  useEffect(() => {
    if (nodes.length === 0 && edges.length === 0) return;

    const data = {
      nodes,
      edges,
      tag: currentTag
    };

    // If this is a new flowchart (no UUID) or has unsaved changes
    if (!currentUuid || hasUnsavedChanges) {
      localStorage.setItem(`${LOCAL_STORAGE_PREFIX}new`, JSON.stringify(data));
    }
  }, [nodes, edges, currentTag, currentUuid, hasUnsavedChanges]);
  // Add beforeunload event handler
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        // 现代浏览器中的标准方式
        const confirmationMessage = '您有未保存的更改，确定要离开吗？';
        // @ts-ignore - 虽然 returnValue 已弃用，但为了兼容性仍需设置
        e.returnValue = confirmationMessage;
        return confirmationMessage; // 为了兼容旧浏览器
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  // Define loadFlowchart outside of onClick
  // Helper function to generate UUID

  const loadFlowchart = useCallback(async (uuid: string, options: { skipLocalStorageCheck?: boolean } = {}) => {
    if (!isAuthenticated) {
      messageApi.info({ content: '请先登录再加载流程图', duration: 3 });
      setShowLoginModal(true);
      return;
    }

    console.log('loadFlowchart called for uuid:', uuid);
    setIsLoading(true);
    setHasUnsavedChanges(false);
    messageApi.loading({ content: '正在加载流程图...', key: 'loadFlow', duration: 0 });

    if (!options.skipLocalStorageCheck) {
      const localData = loadFromLocalStorage(uuid);
      if (localData) {
        console.log('Loaded from local storage:', uuid);
        setNodes(localData.nodes);
        setEdges(localData.edges);
        setCurrentTag(localData.tag);
        setCurrentUuid(uuid);
      }
    }

    try {
      const response = await fetch(API_ENDPOINTS.notionLoad, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ uuid }),
      });

      if (!response.ok) {
        // If fetch fails but we loaded from LS, keep LS data, show warning
        if (loadFromLocalStorage(uuid)) {
          messageApi.warning({
            content: '与服务器同步失败，显示本地版本',
            key: 'loadFlow',
            duration: 3
          });
        } else {
          throw new Error('加载流程图失败，未找到本地版本');
        }
      } else {
        const data = await response.json();
        // Only update state if fetched data is different from current state
        // (to avoid unnecessary re-renders if LS was up-to-date)
        // Note: Deep comparison might be needed for accuracy, but simple length check for now
        if (nodes.length !== data.nodes?.length || edges.length !== data.edges?.length || currentTag !== data.tag) {
          console.log('Updating state from fetched data:', uuid);
          setNodes(data.nodes || []);
          setEdges(data.edges || []);
          setCurrentTag(data.tag);
          // Update local storage with fetched data
          saveToLocalStorage(uuid, { nodes: data.nodes || [], edges: data.edges || [], tag: data.tag });
        }
        setCurrentUuid(data.uuid); // Always ensure UUID is correct from source
        setHasUnsavedChanges(false); // Reset unsaved changes flag after successful load/sync
        localStorage.removeItem(`${LOCAL_STORAGE_PREFIX}new`); // Clear unsaved changes after successful load
        messageApi.success({ content: '流程图加载成功', key: 'loadFlow', duration: 3 });
      }
    } catch (error) {
      console.error('Failed to load flowchart:', error);
      // Only show error if we didn't load from LS
      if (!loadFromLocalStorage(uuid)) {
        messageApi.error({
          content: `加载流程图失败: ${error instanceof Error ? error.message : '未知错误'}`,
          key: 'loadFlow',
          duration: 3
        });
      }
    } finally {
      console.log('loadFlowchart fetch attempt completed');
      setIsLoading(false); // Set loading false after fetch attempt
    }
  }, [setNodes, setEdges, setCurrentTag, setCurrentUuid, isAuthenticated, currentTag, nodes.length, edges.length, setShowLoginModal]); // Added missing dependencies

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

  // Effect to control login modal based on auth state
  useEffect(() => {
    // Only show modal if auth check is complete and user is not authenticated
    if (checkTokenValidity && !isAuthenticated) {
      // Check if checkTokenValidity is available before calling
      const isValid = checkTokenValidity();
      if (!isValid) {
        setShowLoginModal(true);
      }
    } else {
      // Hide modal if authenticated or during initial check
      setShowLoginModal(false);
    }
    // Add checkTokenValidity to dependency array if it's stable (useCallback)
  }, [isAuthenticated, checkTokenValidity]);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      setNodes((nds) => {
        const updatedNodes = applyNodeChanges(changes, nds);
        setHasUnsavedChanges(true);
        return updatedNodes;
      });
    },
    [setNodes]
  );
  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      setEdges((eds) => {
        const updatedEdges = applyEdgeChanges(changes, eds);
        setHasUnsavedChanges(true);
        return updatedEdges;
      });
    },
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
      setEdges((eds) => {
        setHasUnsavedChanges(true);
        return addEdge(newEdge, eds);
      });
    },
    [setEdges, setHasUnsavedChanges]
  );

  // --- Edge Hover Handlers ---
  const onEdgeMouseEnter = useCallback((_event: React.MouseEvent, edge: Edge) => {
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
    setNodes((nds) => {
      setHasUnsavedChanges(true);
      return nds.concat(newNode);
    });
  }, [setNodes, getId, setHasUnsavedChanges]);


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
          messageApi.info({ content: 'Clipboard is empty.', duration: 3 });
        }
      } else {
        // Add a new node based on the key (text, image, etc.)
        addNode(e.key, position);
      }

      setMenu({ show: false, x: 0, y: 0 }); // Hide pane menu
    },
    [addNode, menu.x, menu.y, reactFlowInstance, clipboard, setNodes, setClipboard, getId] // Added getId dependency
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
          messageApi.success({ content: `Node "${targetNode.data.label || targetNode.id}" copied.`, duration: 3 });
          break;
        case 'cut':
          setClipboard({ node: { ...targetNode }, type: 'cut' }); // Store a copy for pasting
          // Remove the node and connected edges
          setNodes((nds) => nds.filter((n) => n.id !== targetNodeId));
          setEdges((eds) => eds.filter((edge) => edge.source !== targetNodeId && edge.target !== targetNodeId));
          messageApi.success({ content: `Node "${targetNode.data.label || targetNode.id}" cut.`, duration: 3 });
          break;
        case 'break-sort':
          // Remove all edges connected to the node, making it an unsorted task
          setEdges((eds) => eds.filter((edge) => edge.source !== targetNodeId && edge.target !== targetNodeId));
          messageApi.success({ content: `Node "${targetNode.data.label || targetNode.id}" moved to unsorted tasks.`, duration: 3 });
          break;
        case 'delete':
          // Remove the node and connected edges
          setNodes((nds) => nds.filter((n) => n.id !== targetNodeId));
          setEdges((eds) => eds.filter((edge) => edge.source !== targetNodeId && edge.target !== targetNodeId));
          messageApi.success({ content: `Node "${targetNode.data.label || targetNode.id}" deleted.`, duration: 3 });
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


  // 定义获取标签列表的函数
  const fetchFlowcharts = useCallback(async () => {
    if (!isAuthenticated) {
      console.log('未登录，跳过获取标签列表');
      return;
    }

    messageApi.loading({ content: '正在获取标签列表...', key: 'fetchTags' });
    try {
      const response = await fetch(API_ENDPOINTS.notionListTags, {
        headers: getAuthHeaders()
      });

      if (!response.ok) {
        throw new Error(`获取标签列表失败: ${response.status}`);
      }

      const data = await response.json();
      if (data.flowcharts) {
        // Ensure the fetched data matches the new type
        setFlowcharts(data.flowcharts as Array<{ tag: string; uuid: string; created_time: string }>);
        messageApi.success({ content: '标签列表获取成功', key: 'fetchTags', duration: 3 });
      }
    } catch (error) {
      console.error('Failed to fetch flowcharts:', error);
      messageApi.error({ content: '获取标签列表失败', key: 'fetchTags', duration: 3 });
    }
  }, [isAuthenticated]);

  // 在登录状态变化时获取标签列表
  useEffect(() => {
    if (isAuthenticated) {
      fetchFlowcharts();
    } else {
      // 未登录时清空标签列表
      setFlowcharts([]);
    }
  }, [isAuthenticated, fetchFlowcharts]);

  // 在组件挂载时执行本地存储清理
  useEffect(() => {
    cleanupLocalStorage();
  }, []);

  // Effect for initial load logic (URL param or local storage for initial UUID)
  useEffect(() => {
    const talkUuidFromUrl = searchParams.get('talk');

    if (talkUuidFromUrl) {
      // If URL has talk param and it's different from current, load it
      if (talkUuidFromUrl !== currentUuid) {
        console.log("Loading from URL param:", talkUuidFromUrl);
        loadFlowchart(talkUuidFromUrl);
      }
    } else {
      // No URL param, try loading initial state from local storage using the generated UUID
      console.log("No URL param, checking LS for initial UUID:", currentUuid);
      const initialLocalData = loadFromLocalStorage(currentUuid);
      if (initialLocalData) {
        console.log("Loading initial state from LS:", currentUuid);
        setNodes(initialLocalData.nodes);
        setEdges(initialLocalData.edges);
        setCurrentTag(initialLocalData.tag);
        setHasUnsavedChanges(true); // Mark as unsaved if loaded from LS
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]); // Run only when searchParams change (effectively on initial load and URL changes)
  // Note: Dependencies like loadFlowchart, currentUuid are intentionally omitted
  // to make this run primarily based on URL changes or initial mount state.


  // Auto-save to local storage on changes
  useEffect(() => {
    // Don't save initial empty state immediately on mount unless interacted with
    const isTrulyInitial = nodes === initialNodes && edges === initialEdges && !hasUnsavedChanges;

    if (!isLoading && !isTrulyInitial && currentUuid) {
      saveToLocalStorage(currentUuid, { nodes, edges, tag: currentTag });
      setHasUnsavedChanges(true); // Mark changes as unsaved when saving to LS
      console.log("Auto-saved to LS for UUID:", currentUuid);
    }
  }, [nodes, edges, currentTag, currentUuid, isLoading, hasUnsavedChanges]); // Depend on state being saved

  // Function to actually perform the save operation with a tag
  const confirmSave = async (tag: string) => {
    if (!isAuthenticated) {
      message.info({ content: '请先登录再保存流程图', duration: 3 });
      setShowLoginModal(true);
      return;
    }

    if (!tag) {
      message.error({ content: '标签名称不能为空', duration: 3 });
      return;
    }
    if (!reactFlowInstance) {
      message.error({ content: '流程图实例未就绪', duration: 3 });
      return;
    }
    const currentNodes = nodes;
    const currentEdges = edges;
    if (!currentNodes || currentNodes.length === 0) {
      message.warning({ content: '画布为空，没有内容可保存', duration: 3 });
      return;
    }

    setIsSaving(true);
    setIsTagModalVisible(false); // Close modal before saving
    messageApi.loading({ content: `正在保存标签 "${tag}"...`, key: 'save_notion', duration: 0 });

    try {
      const uuid = currentUuid || generateUuid();
      const response = await fetch(API_ENDPOINTS.notionSave, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          nodes: currentNodes,
          edges: currentEdges,
          tag,
          uuid
        }),
      });

      // Update UUID if it was newly generated
      if (!currentUuid) {
        setCurrentUuid(uuid);
      }

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || `服务器错误: ${response.status}`);
      }
      messageApi.success({ content: result.message || '保存成功!', key: 'save_notion', duration: 3 }); // Duration 3s
      setHasUnsavedChanges(false);

      // Clear local storage for this UUID on successful save
      clearFromLocalStorage(uuid); // Use the uuid that was saved

      // Refresh tags list
      messageApi.loading({ content: '正在刷新标签列表...', key: 'refreshTags', duration: 0 });
      try {
        const flowchartsResponse = await fetch(API_ENDPOINTS.notionListTags, {
          headers: getAuthHeaders()
        });

        if (!flowchartsResponse.ok) {
          throw new Error(`获取标签列表失败: ${flowchartsResponse.status}`);
        }

        const flowchartsData = await flowchartsResponse.json();
        if (flowchartsData.flowcharts) {
          setFlowcharts(flowchartsData.flowcharts as Array<{ tag: string; uuid: string; created_time: string }>);
          messageApi.success({ content: '标签列表已更新', key: 'refreshTags', duration: 2 });
        }
      } catch (listError) {
        console.error('Failed to refresh tags list:', listError);
        messageApi.error({ content: '刷新标签列表失败', key: 'refreshTags', duration: 3 });
      }

    } catch (error) {
      console.error('Failed to save:', error);
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      messageApi.error({ content: `保存失败: ${errorMessage}`, key: 'save_notion', duration: 3 }); // Duration 3s
    } finally {
      setIsSaving(false);
      setTagInputValue(''); // Clear input value after attempt
    }
  };

  // Modified handleSave to just open the modal
  const handleSave = () => {
    if (!isAuthenticated) {
      messageApi.info({ content: '请先登录再保存流程图', duration: 3 });
      setShowLoginModal(true);
      return;
    }

    if (!nodes || nodes.length === 0) {
      messageApi.warning({ content: '画布为空，没有内容可保存', duration: 3 });
      return;
    }
    // Use current tag as default value
    setTagInputValue(currentTag);
    setIsTagModalVisible(true);
  };

  // Filtered and sorted flowcharts
  const filteredFlowcharts = useMemo(() => {
    // Filter first, then sort by created_time descending
    return flowcharts
      .filter(fc => fc.tag.toLowerCase().includes(filterText.toLowerCase()))
      .sort((a, b) => new Date(b.created_time).getTime() - new Date(a.created_time).getTime());
  }, [flowcharts, filterText]);


  // --- Delete Flowchart Logic ---
  // Function to initiate deletion confirmation
  const requestDeleteFlowchart = (flowchart: { uuid: string; tag: string }) => {
    setFlowchartToDelete(flowchart); // Set state to open the modal
  };

  // Function to perform the actual deletion after confirmation
  const confirmDeleteFlowchart = async () => {
    if (!flowchartToDelete) return;

    if (!isAuthenticated) {
      message.info({ content: '请先登录再删除流程图', duration: 3 });
      setShowLoginModal(true);
      setFlowchartToDelete(null); // 关闭删除确认框
      return;
    }

    const { uuid: uuidToDelete, tag: tagToDelete } = flowchartToDelete;

    messageApi.loading({ content: `正在删除 "${tagToDelete}"...`, key: 'delete_flowchart', duration: 0 });
    try {
      const response = await fetch(API_ENDPOINTS.notionDelete, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ uuid: uuidToDelete }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || `服务器错误: ${response.status}`);
      }

      messageApi.success({ content: `"${tagToDelete}" 已删除`, key: 'delete_flowchart', duration: 3 });

      // Remove from local state
      setFlowcharts(prevFlowcharts => prevFlowcharts.filter(fc => fc.uuid !== uuidToDelete));

      // 删除本地存储中的数据
      clearFromLocalStorage(uuidToDelete);

      // Check if the deleted flowchart was the currently loaded one
      if (uuidToDelete === currentUuid) {
        // Reset to a new state - Ensure state updates happen first
        const newUuid = generateUuid(); // Generate new UUID
        setNodes([]);
        setEdges([]);
        setCurrentTag("未命名");
        setCurrentUuid(newUuid); // Set the new UUID
        setHasUnsavedChanges(false);
        // THEN clear URL params, which might trigger the searchParams effect
        router.push('/', { scroll: false });
        messageApi.info({ content: '当前流程图已被删除，已创建新的空白流程图', duration: 3 });
      }

    } catch (error) {
      console.error('Failed to delete flowchart:', error);
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      messageApi.error({ content: `删除失败: ${errorMessage}`, key: 'delete_flowchart', duration: 3 });
    } finally {
      setFlowchartToDelete(null); // Close the modal regardless of success/failure
    }
  };


  return (
    <>
      {/* 消息上下文持有者 - 必须在组件渲染树中 */}
      {contextHolder}

      <LoginModal
        open={showLoginModal}
        onCancel={() => setShowLoginModal(false)}
        onSuccess={(token) => {
          login(token);
          messageApi.success('登录成功!'); // 使用 messageApi 而非全局 message
          setShowLoginModal(false);
          // 移除这里的fetchListTags调用，避免重复请求
          // 登录状态变化会触发useEffect中的fetchFlowcharts
        }}
      />
      <Layout style={layoutStyle}>
        <Header style={headerStyle}>
          <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>Visual TodoFlow</div>
          {isAuthenticated ? (
            <>
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
                  保存
                </Button>
                <Button
                  icon={<PlusOutlined />}
                  onClick={() => {
                    const newUuid = generateUuid();
                    setNodes([]);
                    setEdges([]);
                    setCurrentTag("未命名");
                    setCurrentUuid(newUuid);
                    setHasUnsavedChanges(false);
                    router.push('/', { scroll: false });
                  }}
                >
                  新建
                </Button>
                <Button
                  icon={<LogoutOutlined />}
                  onClick={() => {
                    logout();
                    setShowLoginModal(true);
                  }}
                >
                  退出
                </Button>
              </Space>
            </>
          ) : (
            <Button
              type="primary"
              onClick={() => setShowLoginModal(true)}
            >
              登录
            </Button>
          )}
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
                <Input
                  placeholder="Filter by name..."
                  value={filterText}
                  onChange={(e) => setFilterText(e.target.value)}
                  style={{ marginBottom: '8px' }}
                  allowClear
                />
                <div style={{
                  maxHeight: '360px', // Adjust max height slightly after adding input
                  overflowY: 'auto',
                  border: '1px solid #f0f0f0',
                  borderRadius: '4px'
                }}>
                  {flowcharts.length > 0 ? (
                    filteredFlowcharts.length > 0 ? (<List
                      size="small"
                      dataSource={filteredFlowcharts} // Use filtered list
                      renderItem={(flowchart) => (
                        <List.Item
                          style={{
                            padding: '8px 12px',
                            // cursor: 'pointer', // Remove cursor from the whole item
                            backgroundColor: currentUuid === flowchart.uuid ? '#e6f4ff' : undefined,
                            color: currentUuid === flowchart.uuid ? '#1677ff' : undefined,
                            display: 'flex', // Use flexbox for alignment
                            justifyContent: 'space-between', // Space out content and button
                            alignItems: 'center', // Vertically align items
                          }}
                        // Remove onClick from List.Item to avoid conflicts
                        >
                          {/* Flowchart Tag - Make this clickable */}
                          <span
                            style={{ flexGrow: 1, marginRight: '8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'pointer' }} // Add cursor pointer here
                            onClick={() => { // Add onClick here for loading
                              const newPath = `/?talk=${flowchart.uuid}`;
                              if (currentUuid !== flowchart.uuid) {
                                router.push(newPath, { scroll: false });
                                loadFlowchart(flowchart.uuid);
                              } else {
                                router.push(newPath, { scroll: false });
                              }
                            }}
                          >
                            {isLoading && currentUuid === flowchart.uuid
                              ? `${flowchart.tag} (loading...)`
                              : flowchart.tag}
                          </span>

                          {/* Delete Button */}
                          <Button
                            type="text"
                            danger
                            icon={<CloseCircleOutlined />}
                            size="small"
                            onClick={(e) => {
                              e.stopPropagation(); // Prevent any potential parent onClick handlers
                              requestDeleteFlowchart(flowchart); // Call function to set state and open modal
                            }}
                            style={{ flexShrink: 0 }} // Prevent button from shrinking
                          />
                        </List.Item>
                      )}
                    />
                    ) : (
                      <div style={{ padding: '16px', color: '#888', textAlign: 'center' }}>
                        No matching flowcharts found.
                      </div>)
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

        {/* Delete Confirmation Modal */}
        <Modal
          title={`确认删除 "${flowchartToDelete?.tag}"?`}
          open={!!flowchartToDelete}
          onOk={confirmDeleteFlowchart}
          onCancel={() => setFlowchartToDelete(null)}
          okText="确认删除"
          okType="danger"
          cancelText="取消"
        >
          <p>此操作将从 Notion 中删除该流程图，且无法撤销。</p>
        </Modal>

      </Layout>
    </> // Close Fragment
  );
}

// Wrap main export in ReactFlowProvider and App for Modal context
const FlowWithSearchParams = () => {
  const searchParams = useSearchParams();
  return (
    <FlowEditor searchParams={searchParams} />
  );
};

export default function Home() {
  return (
    <ReactFlowProvider>
      <Suspense fallback={<div>Loading flow editor...</div>}>
        <FlowWithSearchParams />
      </Suspense>
    </ReactFlowProvider>
  );
}
