'use client';

import React, { useEffect } from 'react';
import { message, App, ConfigProvider } from 'antd';

// 创建一个专门的消息提供者组件
export default function MessageProvider({ children }: { children: React.ReactNode }) {
  // 配置全局消息提示
  useEffect(() => {
    // 配置全局消息提示
    message.config({
      top: 100, // 消息距离顶部的距离
      duration: 3, // 默认显示时间
      maxCount: 3, // 最大显示数量
      rtl: false, // 从右到左显示
    });
  }, []);

  return (
    <App message={{ maxCount: 3 }}>
      {children}
    </App>
  );
}
