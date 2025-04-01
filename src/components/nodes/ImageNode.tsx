import React, { memo, useState, useEffect, useCallback } from 'react';
import { Handle, Position, NodeProps, useReactFlow, useStoreApi } from 'reactflow'; // Added hooks
import { PictureOutlined, UploadOutlined } from '@ant-design/icons';
import { Button, Upload, message, Spin } from 'antd'; // Added Spin
import type { UploadChangeParam } from 'antd/es/upload/interface'; // Import specific type

// Basic styling
const nodeStyle: React.CSSProperties = {
  padding: '10px 15px',
  border: '1px solid #ddd',
  borderRadius: '8px',
  background: '#fff',
  minWidth: '180px',
  borderTop: '4px solid #1677ff',
  fontSize: '12px',
  position: 'relative',
};

const labelStyle: React.CSSProperties = {
  fontWeight: 'bold',
  marginBottom: '8px',
  color: '#333',
  display: 'flex',
  alignItems: 'center',
};

const contentStyle: React.CSSProperties = {
  color: '#555',
  textAlign: 'center',
  minHeight: '50px', // Ensure space for spinner or image
};

const imagePreviewStyle: React.CSSProperties = {
    maxWidth: '100%',
    maxHeight: '150px',
    marginTop: '8px',
    display: 'block',
    marginLeft: 'auto',
    marginRight: 'auto',
};

// Basic handle style
const handleStyle: React.CSSProperties = {
    background: '#555',
    width: '8px',
    height: '8px',
};

// Define the props specific to our ImageNode data
interface ImageNodeData {
  label?: string;
  imageUrl?: string; // URL of the uploaded image
}

const ImageNode = memo(({ data, id }: NodeProps<ImageNodeData>) => {
  const [imageUrl, setImageUrl] = useState<string | undefined>(data.imageUrl);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const { setNodes } = useReactFlow();
  const store = useStoreApi();

  // Update internal state if node data changes externally
  useEffect(() => {
    setImageUrl(data.imageUrl);
  }, [data.imageUrl]);

  // Function to update the node data in the main React Flow state
  const updateNodeImageUrl = useCallback((newImageUrl: string | undefined) => {
    const { nodeInternals } = store.getState();
    setNodes(
      Array.from(nodeInternals.values()).map((node) => {
        if (node.id === id) {
          node.data = {
            ...node.data,
            imageUrl: newImageUrl,
          };
        }
        return node;
      })
    );
  }, [id, setNodes, store]);


  const handleUploadChange = (info: UploadChangeParam) => {
    if (info.file.status === 'uploading') {
      setIsLoading(true);
      return;
    }
    if (info.file.status === 'done') {
      setIsLoading(false);
      const response = info.file.response; // API response
      if (response?.success && response?.url) {
        message.success(`${info.file.name} uploaded successfully`);
        setImageUrl(response.url); // Update local state for preview
        updateNodeImageUrl(response.url); // Update the actual node data
      } else {
        message.error(response?.error || `${info.file.name} upload failed.`);
        setImageUrl(undefined); // Clear preview on failure
        updateNodeImageUrl(undefined);
      }
    } else if (info.file.status === 'error') {
      setIsLoading(false);
      message.error(`${info.file.name} upload failed.`);
      setImageUrl(undefined); // Clear preview on failure
      updateNodeImageUrl(undefined);
    }
  };

  return (
    <div style={nodeStyle}>
      {/* Handles */}
      <Handle type="target" position={Position.Top} id="top-target" style={handleStyle} />
      <Handle type="source" position={Position.Top} id="top-source" style={handleStyle} />
      <Handle type="target" position={Position.Right} id="right-target" style={handleStyle} />
      <Handle type="source" position={Position.Right} id="right-source" style={handleStyle} />
      <Handle type="target" position={Position.Bottom} id="bottom-target" style={handleStyle} />
      <Handle type="source" position={Position.Bottom} id="bottom-source" style={handleStyle} />
      <Handle type="target" position={Position.Left} id="left-target" style={handleStyle} />
      <Handle type="source" position={Position.Left} id="left-source" style={handleStyle} />

      {/* Node Content */}
      <div style={labelStyle}>
        <PictureOutlined style={{ marginRight: '5px' }} /> {data.label || 'Image Node'}
      </div>
      <div style={contentStyle}>
        {isLoading ? (
            <Spin />
        ) : imageUrl ? (
          <img src={imageUrl} alt="Uploaded preview" style={imagePreviewStyle} />
        ) : (
          <Upload
            name="file" // This key must match the one expected by the backend (formidable)
            action="/api/upload" // Point to the upload API route
            showUploadList={false}
            onChange={handleUploadChange}
            // Optional: Add headers, progress handling, etc.
            // beforeUpload={...} // Add validation (e.g., file type, size)
            accept="image/*" // Accept only image files
          >
            <Button icon={<UploadOutlined />}>Upload Image</Button>
          </Upload>
        )}
      </div>

    </div>
  );
});

ImageNode.displayName = 'ImageNode';

export default ImageNode;