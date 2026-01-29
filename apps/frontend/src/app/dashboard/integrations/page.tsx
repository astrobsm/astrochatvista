// ============================================================================
// CHATVISTA - Integrations Page
// Manage third-party integrations
// ============================================================================

'use client';

import React, { useState, useEffect } from 'react';
import {
  Link2,
  Check,
  X,
  Loader2,
  Calendar,
  MessageSquare,
  FileText,
  Zap,
  ExternalLink,
  RefreshCw,
} from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';

interface Integration {
  id: string;
  provider: string;
  status: 'connected' | 'disconnected' | 'error';
  lastSyncAt?: Date;
}

interface AvailableIntegration {
  id: string;
  name: string;
  description: string;
  icon: string;
}

const INTEGRATION_ICONS: Record<string, React.ElementType> = {
  'google-calendar': Calendar,
  'outlook-calendar': Calendar,
  slack: MessageSquare,
  notion: FileText,
  zapier: Zap,
};

export default function IntegrationsPage() {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [available, setAvailable] = useState<AvailableIntegration[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [connecting, setConnecting] = useState<string | null>(null);

  useEffect(() => {
    loadIntegrations();
  }, []);

  const loadIntegrations = async () => {
    setIsLoading(true);
    try {
      const [connected, avail] = await Promise.all([
        api.integrations.list(),
        api.integrations.available(),
      ]);
      setIntegrations(connected.integrations || []);
      setAvailable(avail.integrations || []);
    } catch (error) {
      console.error('Failed to load integrations:', error);
      // Mock data for demonstration
      setAvailable([
        {
          id: 'google-calendar',
          name: 'Google Calendar',
          description: 'Sync meetings with Google Calendar',
          icon: 'google',
        },
        {
          id: 'outlook-calendar',
          name: 'Outlook Calendar',
          description: 'Sync meetings with Microsoft Outlook',
          icon: 'microsoft',
        },
        {
          id: 'slack',
          name: 'Slack',
          description: 'Get meeting notifications in Slack',
          icon: 'slack',
        },
        {
          id: 'notion',
          name: 'Notion',
          description: 'Export meeting notes to Notion',
          icon: 'notion',
        },
        {
          id: 'zapier',
          name: 'Zapier',
          description: 'Connect with 5000+ apps via Zapier',
          icon: 'zapier',
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConnect = async (providerId: string) => {
    setConnecting(providerId);
    try {
      const { authUrl } = await api.integrations.connect(providerId, {
        redirectUri: `${window.location.origin}/dashboard/integrations/callback`,
      });
      window.location.href = authUrl;
    } catch (error) {
      console.error('Failed to connect:', error);
      setConnecting(null);
    }
  };

  const handleDisconnect = async (integrationId: string) => {
    if (!confirm('Are you sure you want to disconnect this integration?')) return;

    try {
      await api.integrations.disconnect(integrationId);
      setIntegrations(integrations.filter((i) => i.id !== integrationId));
    } catch (error) {
      console.error('Failed to disconnect:', error);
    }
  };

  const handleSync = async (integrationId: string) => {
    try {
      await api.integrations.sync(integrationId);
      loadIntegrations();
    } catch (error) {
      console.error('Failed to sync:', error);
    }
  };

  const isConnected = (providerId: string) => {
    return integrations.some((i) => i.provider === providerId && i.status === 'connected');
  };

  const getIntegration = (providerId: string) => {
    return integrations.find((i) => i.provider === providerId);
  };

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Header */}
      <header className="border-b border-gray-700">
        <div className="max-w-4xl mx-auto px-8 py-6">
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Link2 className="w-6 h-6 text-blue-400" />
            Integrations
          </h1>
          <p className="text-gray-400">Connect ChatVista with your favorite tools</p>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-8 py-8">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Connected Integrations */}
            {integrations.length > 0 && (
              <div className="bg-gray-800 border border-gray-700 rounded-2xl p-6">
                <h2 className="text-lg font-semibold text-white mb-4">Connected</h2>
                <div className="space-y-4">
                  {integrations.map((integration) => {
                    const Icon = INTEGRATION_ICONS[integration.provider] || Link2;
                    const info = available.find((a) => a.id === integration.provider);

                    return (
                      <div
                        key={integration.id}
                        className="flex items-center justify-between p-4 bg-gray-700/50 rounded-xl"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-xl bg-gray-600 flex items-center justify-center">
                            <Icon className="w-6 h-6 text-white" />
                          </div>
                          <div>
                            <h3 className="text-white font-medium">{info?.name || integration.provider}</h3>
                            <p className="text-gray-400 text-sm">
                              {integration.lastSyncAt
                                ? `Last synced ${new Date(integration.lastSyncAt).toLocaleString()}`
                                : 'Connected'}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleSync(integration.id)}
                            className="p-2 text-gray-400 hover:text-white hover:bg-gray-600 rounded-lg transition-colors"
                            title="Sync now"
                          >
                            <RefreshCw className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => handleDisconnect(integration.id)}
                            className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors"
                            title="Disconnect"
                          >
                            <X className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Available Integrations */}
            <div className="bg-gray-800 border border-gray-700 rounded-2xl p-6">
              <h2 className="text-lg font-semibold text-white mb-4">Available Integrations</h2>
              <div className="grid grid-cols-2 gap-4">
                {available.map((integration) => {
                  const Icon = INTEGRATION_ICONS[integration.id] || Link2;
                  const connected = isConnected(integration.id);

                  return (
                    <div
                      key={integration.id}
                      className={`p-4 rounded-xl border transition-colors ${
                        connected
                          ? 'bg-green-500/10 border-green-500/20'
                          : 'bg-gray-700/50 border-gray-700 hover:border-gray-600'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div className="w-12 h-12 rounded-xl bg-gray-600 flex items-center justify-center">
                          <Icon className="w-6 h-6 text-white" />
                        </div>
                        {connected && (
                          <span className="flex items-center gap-1 text-green-400 text-sm">
                            <Check className="w-4 h-4" />
                            Connected
                          </span>
                        )}
                      </div>

                      <h3 className="text-white font-medium mb-1">{integration.name}</h3>
                      <p className="text-gray-400 text-sm mb-4">{integration.description}</p>

                      {!connected && (
                        <Button
                          onClick={() => handleConnect(integration.id)}
                          isLoading={connecting === integration.id}
                          fullWidth
                          size="sm"
                        >
                          Connect
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* API Keys */}
            <div className="bg-gray-800 border border-gray-700 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-semibold text-white">API Access</h2>
                  <p className="text-gray-400 text-sm">
                    Build custom integrations with the ChatVista API
                  </p>
                </div>
                <Button variant="secondary" leftIcon={ExternalLink}>
                  View API Docs
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
