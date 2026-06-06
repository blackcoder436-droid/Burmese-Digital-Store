import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import { RotateConfig, getRotateConfig } from '@/models/RotateConfig';
import { requireAdmin } from '@/lib/auth';
import { apiLimiter } from '@/lib/rateLimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function cleanSecret(value: unknown): string {
  return String(value || '')
    .trim()
    .replace(/^Bearer\s+/i, '')
    .replace(/^Authorization:\s*Bearer\s+/i, '')
    .trim();
}

function cleanText(value: unknown, maxLength = 5000): string {
  return String(value || '').trim().slice(0, maxLength);
}

function cleanSlug(value: unknown, fallback = ''): string {
  return String(value || fallback)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_.:-]/g, '')
    .slice(0, 120);
}

function cleanCsvText(value: unknown): string {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .join(', ');
}

function sanitizeRotateTokens(input: unknown, fallback: unknown[] = []) {
  const source = Array.isArray(input) ? input : fallback;
  return source
    .map((entry, index) => {
      const row = entry as Record<string, unknown>;
      const token = cleanSecret(row.token);
      const id = String(row.id || `do-token-${index + 1}`).trim() || `do-token-${index + 1}`;
      const label = String(row.label || `Token ${index + 1}`).trim() || `Token ${index + 1}`;
      const enabled = typeof row.enabled === 'boolean' ? row.enabled : true;
      return { id, label, token, enabled };
    })
    .filter((row) => row.token);
}

function sanitizeCfAccounts(input: unknown, fallback: unknown[] = []) {
  const source = Array.isArray(input) ? input : fallback;
  return source
    .map((entry, index) => {
      const row = entry as Record<string, unknown>;
      const token = cleanSecret(row.token);
      const id = String(row.id || `cf-account-${index + 1}`).trim() || `cf-account-${index + 1}`;
      const label = String(row.label || `Cloudflare ${index + 1}`).trim() || `Cloudflare ${index + 1}`;
      const email = String(row.email || '').trim().toLowerCase();
      const enabled = typeof row.enabled === 'boolean' ? row.enabled : true;
      return { id, label, token, email, enabled };
    })
    .filter((row) => row.token);
}

function sanitizeServerLinks(input: unknown, fallback: unknown[] = []) {
  const source = Array.isArray(input) ? input : fallback;
  return source
    .map((entry, index) => {
      const row = entry as Record<string, unknown>;
      const serverName = String(row.serverName || '').trim();
      const tokenId = String(row.tokenId || '').trim();
      const id = String(row.id || `server-link-${index + 1}`).trim() || `server-link-${index + 1}`;
      const enabled = typeof row.enabled === 'boolean' ? row.enabled : true;
      return { id, serverName, tokenId, enabled };
    })
    .filter((row) => row.serverName && row.tokenId);
}

// GET: Retrieve rotation configuration
export async function GET(request: NextRequest) {
  const limited = await apiLimiter(request);
  if (limited) return limited;

  try {
    await requireAdmin();
    await connectDB();

    const config = await getRotateConfig();

    return NextResponse.json({
      success: true,
      data: { config },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH: Update rotation configuration
export async function PATCH(request: NextRequest) {
  const limited = await apiLimiter(request);
  if (limited) return limited;

  try {
    await requireAdmin();
    await connectDB();

    const body = await request.json();
    const config = await getRotateConfig();

    if (body.doToken1 !== undefined) config.doToken1 = body.doToken1;
    if (body.doToken2 !== undefined) config.doToken2 = body.doToken2;
    if (body.doToken3 !== undefined) config.doToken3 = body.doToken3;
    if (body.doToken4 !== undefined) config.doToken4 = body.doToken4;
    const incomingTokens = Array.isArray(body.doTokens) ? body.doTokens : undefined;
    const incomingServerLinks = Array.isArray(body.serverLinks) ? body.serverLinks : undefined;
    const incomingCfAccounts = Array.isArray(body.cfAccounts) ? body.cfAccounts : undefined;
    const existingTokens = Array.isArray(config.doTokens) ? config.doTokens : [];
    const existingServerLinks = Array.isArray(config.serverLinks) ? config.serverLinks : [];
    const existingCfAccounts = Array.isArray(config.cfAccounts) ? config.cfAccounts : [];
    const sanitizedTokens = sanitizeRotateTokens(incomingTokens, existingTokens.length > 0 ? existingTokens : [
      { id: 'do-token-1', label: 'Token 1', token: config.doToken1, enabled: true },
      { id: 'do-token-2', label: 'Token 2', token: config.doToken2, enabled: true },
      { id: 'do-token-3', label: 'Token 3', token: config.doToken3 || '', enabled: true },
      { id: 'do-token-4', label: 'Token 4', token: config.doToken4 || '', enabled: true },
    ]);
    const sanitizedServerLinks = sanitizeServerLinks(incomingServerLinks, existingServerLinks);
    const sanitizedCfAccounts = sanitizeCfAccounts(incomingCfAccounts, existingCfAccounts.length > 0 ? existingCfAccounts : [
      { id: 'cf-account-1', label: 'Cloudflare 1', token: config.cfToken, email: config.cfEmail, enabled: true },
    ]);
    if (sanitizedTokens.length > 0) {
      config.doTokens = sanitizedTokens;
      config.doToken1 = sanitizedTokens[0]?.token || '';
      config.doToken2 = sanitizedTokens[1]?.token || '';
      config.doToken3 = sanitizedTokens[2]?.token || '';
      config.doToken4 = sanitizedTokens[3]?.token || '';
    }
    if (incomingServerLinks !== undefined || existingServerLinks.length > 0) {
      config.serverLinks = sanitizedServerLinks;
    }
    if (body.cfToken !== undefined) config.cfToken = cleanSecret(body.cfToken);
    if (body.cfEmail !== undefined) config.cfEmail = String(body.cfEmail || '').trim().toLowerCase();
    if (incomingCfAccounts !== undefined || existingCfAccounts.length > 0) {
      config.cfAccounts = sanitizedCfAccounts;
      config.cfToken = sanitizedCfAccounts[0]?.token || '';
      config.cfEmail = sanitizedCfAccounts[0]?.email || config.cfEmail || '';
    }
    if (body.xuiUsername !== undefined) config.xuiUsername = body.xuiUsername;
    if (body.xuiPassword !== undefined) config.xuiPassword = body.xuiPassword;
    if (body.enable2FA !== undefined) config.enable2FA = body.enable2FA;
    if (body.dropletRegion !== undefined) config.dropletRegion = cleanSlug(body.dropletRegion, 'sgp1');
    if (body.dropletSize !== undefined) config.dropletSize = cleanSlug(body.dropletSize, 's-1vcpu-1gb');
    if (body.dropletImage !== undefined) config.dropletImage = cleanText(body.dropletImage, 120);
    if (body.dropletBackups !== undefined) config.dropletBackups = !!body.dropletBackups;
    if (body.dropletIpv6 !== undefined) config.dropletIpv6 = !!body.dropletIpv6;
    if (body.dropletMonitoring !== undefined) config.dropletMonitoring = !!body.dropletMonitoring;
    if (body.dropletPublicNetworking !== undefined) config.dropletPublicNetworking = !!body.dropletPublicNetworking;
    if (body.dropletAgent !== undefined) config.dropletAgent = !!body.dropletAgent;
    if (body.dropletSshKeys !== undefined) config.dropletSshKeys = cleanCsvText(body.dropletSshKeys);
    if (body.dropletTags !== undefined) config.dropletTags = cleanCsvText(body.dropletTags);
    if (body.dropletVpcUuid !== undefined) config.dropletVpcUuid = cleanText(body.dropletVpcUuid, 120);
    if (body.dropletVolumes !== undefined) config.dropletVolumes = cleanCsvText(body.dropletVolumes);
    if (body.dropletUserData !== undefined) config.dropletUserData = cleanText(body.dropletUserData, 64000);
    if (body.dropletBackupPolicy !== undefined) config.dropletBackupPolicy = cleanText(body.dropletBackupPolicy, 4000);

    await config.save();

    return NextResponse.json({
      success: true,
      data: { config },
      message: 'Rotation configuration updated',
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
