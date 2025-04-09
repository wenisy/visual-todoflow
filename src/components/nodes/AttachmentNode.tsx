import React, { memo, useState, useEffect, useCallback } from 'react';
import { Handle, Position, NodeProps, useReactFlow, useStoreApi } from 'reactflow'; // Added hooks
import { PaperClipOutlined, UploadOutlined, FileOutlined } from '@ant-design/icons';
import { Button, Upload, message, Tooltip, Spin } from 'antd'; // Import Spin from antd
import type { UploadChangeParam } from 'antd/es/upload/interface'; // Import specific type
import { API_ENDPOINTS } from '@/config/api';

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
  minHeight: '50px', // Ensure space for spinner or file info
};

const fileInfoStyle: React.CSSProperties = {
  marginTop: '8px',
  padding: '5px 8px',
  background: '#f9f9f9',
  borderRadius: '4px',
  display: 'inline-flex', // Use inline-flex to fit content
  alignItems: 'center',
  justifyContent: 'center',
  gap: '5px',
  maxWidth: '100%', // Prevent overflow
};

// Basic handle style
const handleStyle: React.CSSProperties = {
  background: '#555',
  width: '8px',
  height: '8px',
};

// Define the props specific to our AttachmentNode data
interface AttachmentNodeData {
  label?: string;
  fileName?: string;
  fileUrl?: string; // URL of the uploaded file
}

const AttachmentNode = memo(({ data, id }: NodeProps<AttachmentNodeData>) => {
  const [fileName, setFileName] = useState<string | undefined>(data.fileName);
  const [fileUrl, setFileUrl] = useState<string | undefined>(data.fileUrl);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const { setNodes } = useReactFlow();
  const store = useStoreApi();

  // Update internal state if node data changes externally
  useEffect(() => {
    setFileName(data.fileName);
    setFileUrl(data.fileUrl);
  }, [data.fileName, data.fileUrl]);

  // Function to update the node data in the main React Flow state
  const updateNodeAttachment = useCallback((newFileName: string | undefined, newFileUrl: string | undefined) => {
    const { nodeInternals } = store.getState();
    setNodes(
      Array.from(nodeInternals.values()).map((node) => {
        if (node.id === id) {
          node.data = {
            ...node.data,
            fileName: newFileName,
            fileUrl: newFileUrl,
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
      const response = info.file.response;
      if (response?.success && response?.url) {
        const originalName = response.fileName || info.file.name; // Use original name from response if available
        message.success(`${originalName} uploaded successfully`);
        setFileName(originalName);
        setFileUrl(response.url);
        updateNodeAttachment(originalName, response.url);
      } else {
        message.error(response?.error || `${info.file.name} upload failed.`);
        setFileName(undefined);
        setFileUrl(undefined);
        updateNodeAttachment(undefined, undefined);
      }
    } else if (info.file.status === 'error') {
      setIsLoading(false);
      message.error(`${info.file.name} upload failed.`);
      setFileName(undefined);
      setFileUrl(undefined);
      updateNodeAttachment(undefined, undefined);
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
        <PaperClipOutlined style={{ marginRight: '5px' }} /> {data.label || 'Attachment Node'}
      </div>
      <div style={contentStyle}>
        {isLoading ? (
          <Spin />
        ) : fileName ? (
          <Tooltip title={fileName}>
            {/* Make the file info clickable if URL exists */}
            {fileUrl ? (
              <a href={fileUrl} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
                <div style={fileInfoStyle}>
                  <FileOutlined />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#333' }}>
                    {fileName}
                  </span>
                </div>
              </a>
            ) : (
              <div style={fileInfoStyle}>
                <FileOutlined />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {fileName}
                </span>
              </div>
            )}

          </Tooltip>
        ) : (
          <Upload
            name="file" // Key for the backend
            action={API_ENDPOINTS.upload} // API endpoint
            showUploadList={false}
            onChange={handleUploadChange}
          // beforeUpload={...} // Optional validation
          >
            <Button icon={<UploadOutlined />}>Upload File</Button>
          </Upload>
        )}
      </div>

    </div>
  );
});

AttachmentNode.displayName = 'AttachmentNode';

export default AttachmentNode;