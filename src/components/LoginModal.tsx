'use client';

import React, { useState } from 'react';
import { Modal, Form, Input, Button, message } from 'antd';
import { API_ENDPOINTS } from '@/config/api';

interface LoginModalProps {
  open: boolean;
  onCancel: () => void;
  onSuccess: (token: string) => void;
}

const LoginModal: React.FC<LoginModalProps> = ({ open, onCancel, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [messageApi, contextHolder] = message.useMessage();

  const handleLogin = async (values: { username: string; password: string }) => {
    setLoading(true);
    messageApi.loading({ content: '正在登录...', key: 'login' });
    try {
      const response = await fetch(API_ENDPOINTS.login, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(values),
      });

      if (!response.ok) {
        throw new Error(`登录失败: ${response.status}`);
      }

      const data = await response.json();
      if (data.token) {
        // 存储token
        localStorage.setItem('auth_token', data.token);
        localStorage.setItem('token_timestamp', Date.now().toString());
        onSuccess(data.token);
        messageApi.success({ content: '登录成功', key: 'login', duration: 3 });
      } else {
        throw new Error('未获取到登录令牌');
      }
    } catch (error) {
      console.error('Login error:', error);
      messageApi.error({
        content: '登录失败，请检查用户名和密码',
        key: 'login',
        duration: 3
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title="登录"
      open={open}
      onCancel={onCancel}
      footer={null}
    >
      {contextHolder}
      <Form
        name="login"
        onFinish={handleLogin}
        layout="vertical"
      >
        <Form.Item
          label="用户名"
          name="username"
          rules={[{ required: true, message: '请输入用户名' }]}
        >
          <Input />
        </Form.Item>

        <Form.Item
          label="密码"
          name="password"
          rules={[{ required: true, message: '请输入密码' }]}
        >
          <Input.Password />
        </Form.Item>

        <Form.Item>
          <Button type="primary" htmlType="submit" loading={loading} block>
            登录
          </Button>
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default LoginModal;