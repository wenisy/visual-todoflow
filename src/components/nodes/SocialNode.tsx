import React, { memo, useState, useCallback, useEffect } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { ShareAltOutlined } from '@ant-design/icons';
import { Input } from 'antd';

// Twitter type declaration
declare global {
  interface Window {
    twttr?: {
      widgets?: {
        load: () => void;
      };
    };
  }
}

// Basic styling
const nodeStyle: React.CSSProperties = {
  padding: '10px 15px',
  border: '1px solid #ddd',
  borderRadius: '8px',
  background: '#fff',
  minWidth: '200px',
  borderTop: '4px solid #1677ff',
  fontSize: '12px',
  position: 'relative', // Needed for handles
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
};

// Basic handle style
const handleStyle: React.CSSProperties = {
    background: '#555',
    width: '8px',
    height: '8px',
};


// Define the props specific to our SocialNode data
interface SocialNodeData {
  label?: string;
  url?: string;
}

// Placeholder for fetching embed data
const fetchEmbedPreview = async (url: string) => {
  console.log("Fetching embed for:", url);
  await new Promise(resolve => setTimeout(resolve, 500));
  if (url.includes('twitter.com') || url.includes('x.com')) {
      return { type: 'rich', html: `<blockquote class="twitter-tweet" data-dnt="true" data-theme="light"><p lang="en" dir="ltr">Loading tweet...</p><a href="${url}">View on X</a></blockquote>` };
  }
  if (url.includes('spotify.com')) {
      const spotifyId = url.split('/').pop()?.split('?')[0];
      return { type: 'rich', html: `<iframe style="border-radius:12px" src="https://open.spotify.com/embed/track/${spotifyId}?utm_source=generator" width="100%" height="152" frameBorder="0" allowfullscreen="" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy"></iframe>` };
  }
  return null;
};


const SocialNode = memo(({ data, id }: NodeProps<SocialNodeData>) => {
  const [url, setUrl] = useState<string>(data.url || '');
  const [embedHtml, setEmbedHtml] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const updateNodeData = (newData: Partial<SocialNodeData>) => {
      console.log(`Node ${id} data updated:`, newData, ". Need to update main state.");
  };

  const handleUrlChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setUrl(event.target.value);
  };

  const handleUrlBlur = useCallback(async () => { // Use useCallback
    if (url && url !== data.url) {
        setIsLoading(true);
        setEmbedHtml(null);
        updateNodeData({ url: url });
        try {
            const embedData = await fetchEmbedPreview(url);
            if (embedData?.html) {
                setEmbedHtml(embedData.html);
                // Special handling for Twitter widget loading
                if (url.includes('twitter.com') || url.includes('x.com')) {
                    // Check if twttr object exists and load widgets
                    if (window.twttr?.widgets?.load) {
                        window.twttr.widgets.load();
                    } else {
                        // Load the script if it's not already loaded (basic check)
                        if (!document.querySelector('script[src="https://platform.twitter.com/widgets.js"]')) {
                            const script = document.createElement('script');
                            script.src = "https://platform.twitter.com/widgets.js";
                            script.async = true;
                            script.charset = "utf-8";
                            document.body.appendChild(script);
                        }
                    }
                }
            } else {
                setEmbedHtml('<p style="color: red; font-size: 10px;">Could not load preview.</p>');
            }
        } catch (error) {
            console.error("Error fetching embed:", error);
            setEmbedHtml('<p style="color: red; font-size: 10px;">Error loading preview.</p>');
        } finally {
            setIsLoading(false);
        }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, data.url, id]); // Add dependencies

  useEffect(() => {
    if (data.url && !embedHtml && !isLoading) { // Check isLoading to prevent multiple fetches
        handleUrlBlur();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.url]); // Depend only on initial data.url


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
        <ShareAltOutlined style={{ marginRight: '5px' }} /> {data.label || 'Social Post Node'}
      </div>
      <div style={contentStyle}>
        <Input
          placeholder="Enter Social Post URL (e.g., X, Spotify)"
          value={url}
          onChange={handleUrlChange}
          onBlur={handleUrlBlur}
          disabled={isLoading}
        />
         <div style={{ marginTop: '8px', minHeight: '50px' }}>
            {isLoading && <p style={{fontSize: '10px', color: '#888'}}>Loading preview...</p>}
            {embedHtml && !isLoading && (
                <div dangerouslySetInnerHTML={{ __html: embedHtml }} />
            )}
         </div>
      </div>

    </div>
  );
});

SocialNode.displayName = 'SocialNode';

export default SocialNode;