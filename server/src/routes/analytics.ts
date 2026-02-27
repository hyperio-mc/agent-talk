/**
 * Analytics Routes
 * 
 * Provides usage statistics, voice popularity, and error tracking
 * for authenticated users.
 */

import { Hono } from 'hono';
import { requireAuth, getAuthUser } from '../middleware/auth.js';
import { 
  getUsageStats, 
  getVoicePopularity, 
  getErrorStats,
  getDashboardSummary 
} from '../services/analytics.js';
import { getMemoCountsByDay, listMemosByUser } from '../db/memos.js';
import { UnauthorizedError } from '../errors/index.js';

export const analyticsRoutes = new Hono();

/**
 * GET /api/v1/analytics/usage
 * Get usage statistics (calls by day/week/month)
 * 
 * Query params:
 * - startDate: ISO date string (optional, defaults to 30 days ago)
 * - endDate: ISO date string (optional, defaults to now)
 */
analyticsRoutes.get('/usage', requireAuth, async (c) => {
  const authUser = getAuthUser(c);
  
  if (!authUser) {
    throw new UnauthorizedError('Not authenticated');
  }
  
  // Parse optional date filters
  const startDateStr = c.req.query('startDate');
  const endDateStr = c.req.query('endDate');
  
  let startDate: Date | undefined;
  let endDate: Date | undefined;
  
  if (startDateStr) {
    startDate = new Date(startDateStr);
    if (isNaN(startDate.getTime())) {
      startDate = undefined;
    }
  }
  
  if (endDateStr) {
    endDate = new Date(endDateStr);
    if (isNaN(endDate.getTime())) {
      endDate = undefined;
    }
  }
  
  const stats = await getUsageStats(authUser.userId, startDate, endDate);
  
  return c.json({
    success: true,
    data: stats,
  });
});

/**
 * GET /api/v1/analytics/voices
 * Get voice popularity statistics
 * Returns most used voices with counts and percentages
 */
analyticsRoutes.get('/voices', requireAuth, async (c) => {
  const authUser = getAuthUser(c);
  
  if (!authUser) {
    throw new UnauthorizedError('Not authenticated');
  }
  
  const popularity = await getVoicePopularity(authUser.userId);
  
  return c.json({
    success: true,
    data: popularity,
  });
});

/**
 * GET /api/v1/analytics/errors
 * Get error statistics
 * Returns error rates and breakdown by type
 * 
 * Query params:
 * - startDate: ISO date string (optional, defaults to 30 days ago)
 * - endDate: ISO date string (optional, defaults to now)
 */
analyticsRoutes.get('/errors', requireAuth, async (c) => {
  const authUser = getAuthUser(c);
  
  if (!authUser) {
    throw new UnauthorizedError('Not authenticated');
  }
  
  // Parse optional date filters
  const startDateStr = c.req.query('startDate');
  const endDateStr = c.req.query('endDate');
  
  let startDate: Date | undefined;
  let endDate: Date | undefined;
  
  if (startDateStr) {
    startDate = new Date(startDateStr);
    if (isNaN(startDate.getTime())) {
      startDate = undefined;
    }
  }
  
  if (endDateStr) {
    endDate = new Date(endDateStr);
    if (isNaN(endDate.getTime())) {
      endDate = undefined;
    }
  }
  
  const stats = await getErrorStats(authUser.userId, startDate, endDate);
  
  return c.json({
    success: true,
    data: stats,
  });
});

/**
 * GET /api/v1/analytics/summary
 * Get dashboard summary
 * Returns overall stats for quick overview
 */
analyticsRoutes.get('/summary', requireAuth, async (c) => {
  const authUser = getAuthUser(c);
  
  if (!authUser) {
    throw new UnauthorizedError('Not authenticated');
  }
  
  const summary = await getDashboardSummary(authUser.userId);
  
  return c.json({
    success: true,
    data: summary,
  });
});

/**
 * GET /api/v1/analytics/export
 * Export usage data as CSV
 * Downloads a CSV file with memo history
 */
analyticsRoutes.get('/export', requireAuth, async (c) => {
  const authUser = getAuthUser(c);
  
  if (!authUser) {
    throw new UnauthorizedError('Not authenticated');
  }
  
  // Get optional date range
  const daysStr = c.req.query('days');
  const days = daysStr ? parseInt(daysStr, 10) : 30;
  
  // Get memo history
  const memos = await listMemosByUser(authUser.userId);
  
  // Get daily usage
  const dailyUsage = await getMemoCountsByDay(authUser.userId, days);
  
  // Build CSV for memos
  const memosCsv = [
    'ID,Date,Voice,Character Count,Duration (seconds),Audio URL',
    ...memos.map(m => 
      `"${m.id}","${m.created_at}","${m.voice || ''}",${m.character_count || 0},${m.duration_sec || 0},"${m.audio_url || ''}"`
    )
  ].join('\n');
  
  // Build CSV for daily usage
  const dailyCsv = [
    'Date,Calls,Characters',
    ...dailyUsage.map(d => `"${d.date}",${d.count},0`)
  ].join('\n');
  
  // Combine into sections
  const csv = `# Memo History
${memosCsv}

# Daily Usage (Last ${days} Days)
${dailyCsv}`;
  
  // Return as downloadable file
  const filename = `agent-talk-usage-${new Date().toISOString().split('T')[0]}.csv`;
  
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
});

/**
 * GET /api/v1/analytics/charts
 * Get chart data for dashboard
 * Returns data formatted for charting libraries
 */
analyticsRoutes.get('/charts', requireAuth, async (c) => {
  const authUser = getAuthUser(c);
  
  if (!authUser) {
    throw new UnauthorizedError('Not authenticated');
  }
  
  const daysStr = c.req.query('days');
  const days = daysStr ? parseInt(daysStr, 10) : 7;
  
  // Get daily usage data
  const dailyData = await getMemoCountsByDay(authUser.userId, days);
  
  // Fill in missing days with zeros
  const chartData: Array<{ date: string; calls: number; characters: number }> = [];
  const today = new Date();
  
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    
    const dayData = dailyData.find(d => d.date === dateStr);
    chartData.push({
      date: dateStr,
      calls: dayData?.count || 0,
      characters: 0,
    });
  }
  
  return c.json({
    success: true,
    data: {
      daily: chartData,
      days,
    },
  });
});