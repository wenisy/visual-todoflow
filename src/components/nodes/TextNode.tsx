import React, { memo, useState, useEffect, useCallback } from 'react';
import { Handle, Position, NodeProps, useReactFlow, useStoreApi, Edge } from 'reactflow';
import { Input, Dropdown } from 'antd';
import type { MenuProps } from 'antd';

const { TextArea } = Input;

// Basic styling
const nodeStyle: React.CSSProperties = {
  padding: '10px 15px',
  border: '1px solid #ddd',
  borderRadius: '8px',
  background: '#fff',
  minWidth: '150px',
  maxWidth: '300px',
  borderTop: '4px solid #1677ff',
  fontSize: '12px',
  position: 'relative',
};

const labelStyle: React.CSSProperties = {
  fontWeight: 'bold',
  marginBottom: '5px',
  color: '#333',
};

const contentStyle: React.CSSProperties = {
  color: '#555',
  whiteSpace: 'pre-wrap',
  cursor: 'pointer',
  minHeight: '20px',
};

const handleStyle: React.CSSProperties = {
  background: '#555',
  width: '8px',
  height: '8px',
};

interface TextNodeData {
  label: string;
  text?: string;
  order?: number;
}

interface TextNodeProps extends NodeProps<TextNodeData> {}

// Badge style for order number
const orderBadgeStyle: React.CSSProperties = {
  position: 'absolute',
  top: '-12px',
  left: '-12px',
  backgroundColor: '#1677ff',
  color: '#fff',
  borderRadius: '50%',
  width: '24px',
  height: '24px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '12px',
  fontWeight: 'bold',
  border: '2px solid #fff',
  boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
};

const TextNode = memo(({ id, data, selected }: TextNodeProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [nodeText, setNodeText] = useState(data.text || '');
  const { setNodes, setEdges } = useReactFlow();
  const store = useStoreApi();

  useEffect(() => {
    setNodeText(data.text || '');
  }, [data.text]);

  const handleDoubleClick = useCallback(() => {
    setIsEditing(true);
  }, []);

  const handleBlur = useCallback(() => {
    setIsEditing(false);
    const { nodeInternals } = store.getState();
    setNodes(
      Array.from(nodeInternals.values()).map((node) => {
        if (node.id === id) {
          node.data = {
            ...node.data,
            text: nodeText,
          };
        }
        return node;
      })
    );
  }, [id, nodeText, setNodes, store]);

  const handleInputChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setNodeText(event.target.value);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleBlur();
    }
  };

  const menuItems = store.getState().edges
    .filter((edge: Edge) => edge.source === id || edge.target === id)
    .map((edge: Edge) => ({
      key: edge.id,
      label: `删除连线 ${edge.source} → ${edge.target}`,
      onClick: () => {
        setEdges(edges => edges.filter(e => e.id !== edge.id));
      }
    }));

  return (
    <Dropdown menu={{ items: menuItems }} trigger={['contextMenu']}>
      <div style={{...nodeStyle, position: 'relative'}} onDoubleClick={handleDoubleClick}>
        {typeof data.order === 'number' && (
          <div style={orderBadgeStyle}>
            {data.order + 1}
          </div>
        )}
        <Handle type="target" position={Position.Top} id="top-target" style={handleStyle} />
        <Handle type="source" position={Position.Top} id="top-source" style={handleStyle} />
        <Handle type="target" position={Position.Right} id="right-target" style={handleStyle} />
        <Handle type="source" position={Position.Right} id="right-source" style={handleStyle} />
        <Handle type="target" position={Position.Bottom} id="bottom-target" style={handleStyle} />
        <Handle type="source" position={Position.Bottom} id="bottom-source" style={handleStyle} />
        <Handle type="target" position={Position.Left} id="left-target" style={handleStyle} />
        <Handle type="source" position={Position.Left} id="left-source" style={handleStyle} />
        
        <div style={labelStyle}>{data.label || 'Text Node'}</div>

        {isEditing ? (
          <TextArea
            value={nodeText}
            onChange={handleInputChange}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            autoSize={{ minRows: 1, maxRows: 6 }}
            autoFocus
            style={{ fontSize: '12px' }}
          />
        ) : (
          <div style={contentStyle}>
            {nodeText || <span style={{ color: '#aaa' }}>Double-click to edit...</span>}
          </div>
        )}
      </div>
    </Dropdown>
  );
});

TextNode.displayName = 'TextNode';

export default TextNode;