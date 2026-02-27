/**
 * Chart utilities for Agent Talk Dashboard
 * 
 * Provides data formatting and chart configuration for usage visualization.
 */

export interface DailyUsage {
  date: string;
  calls: number;
  characters: number;
}

export interface ChartConfig {
  width: number;
  height: number;
  padding: number;
  colors: {
    primary: string;
    secondary: string;
    grid: string;
    text: string;
  };
}

export const defaultChartConfig: ChartConfig = {
  width: 600,
  height: 300,
  padding: 40,
  colors: {
    primary: '#3b82f6', // blue-500
    secondary: '#10b981', // emerald-500
    grid: '#e5e7eb', // gray-200
    text: '#6b7280', // gray-500
  },
};

/**
 * Format usage data for charts
 */
export function formatChartDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  
  const month = date.toLocaleString('en-US', { month: 'short' });
  const day = date.getDate();
  return `${month} ${day}`;
}

/**
 * Calculate chart scales
 */
export function calculateScales(data: DailyUsage[], config: ChartConfig): {
  xScale: (index: number) => number;
  yScale: (value: number) => number;
  maxValue: number;
  chartWidth: number;
  chartHeight: number;
} {
  const chartWidth = config.width - config.padding * 2;
  const chartHeight = config.height - config.padding * 2;
  
  const maxValue = Math.max(
    ...data.map(d => d.calls),
    ...data.map(d => Math.ceil(d.characters / 100)),
    1 // Ensure at least 1 for scale
  );
  
  const xScale = (index: number) => {
    return config.padding + (index / Math.max(data.length - 1, 1)) * chartWidth;
  };
  
  const yScale = (value: number) => {
    return config.height - config.padding - (value / maxValue) * chartHeight;
  };
  
  return { xScale, yScale, maxValue, chartWidth, chartHeight };
}

/**
 * Generate SVG path for a line chart
 */
export function generateLinePath(
  data: DailyUsage[],
  xScale: (index: number) => number,
  yScale: (value: number) => number,
  valueKey: 'calls' | 'characters',
  divisor: number = 1
): string {
  if (data.length === 0) return '';
  
  const points = data.map((d, i) => ({
    x: xScale(i),
    y: yScale(d[valueKey] / divisor),
  }));
  
  // Create smooth curve using cardinal spline
  let path = `M ${points[0].x} ${points[0].y}`;
  
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const tension = 0.3;
    
    const c1x = prev.x + (curr.x - (i > 1 ? points[i - 2].x : prev.x)) * tension;
    const c1y = prev.y;
    const c2x = curr.x - ((i < points.length - 1 ? points[i + 1].x : curr.x) - prev.x) * tension;
    const c2y = curr.y;
    
    path += ` C ${c1x} ${c1y} ${c2x} ${c2y} ${curr.x} ${curr.y}`;
  }
  
  return path;
}

/**
 * Generate SVG path for area fill
 */
export function generateAreaPath(
  data: DailyUsage[],
  xScale: (index: number) => number,
  yScale: (value: number) => number,
  config: ChartConfig,
  valueKey: 'calls' | 'characters',
  divisor: number = 1
): string {
  if (data.length === 0) return '';
  
  const linePath = generateLinePath(data, xScale, yScale, valueKey, divisor);
  const lastX = xScale(data.length - 1);
  const firstX = xScale(0);
  const bottomY = config.height - config.padding;
  
  return `${linePath} L ${lastX} ${bottomY} L ${firstX} ${bottomY} Z`;
}

/**
 * Generate Y-axis ticks
 */
export function generateYTicks(
  maxValue: number,
  config: ChartConfig,
  tickCount: number = 5
): Array<{ value: number; label: string; y: number }> {
  const chartHeight = config.height - config.padding * 2;
  const ticks: Array<{ value: number; label: string; y: number }> = [];
  
  for (let i = 0; i <= tickCount; i++) {
    const value = Math.round((maxValue / tickCount) * i);
    const y = config.height - config.padding - (i / tickCount) * chartHeight;
    
    ticks.push({
      value,
      label: value.toString(),
      y,
    });
  }
  
  return ticks;
}

/**
 * Aggregate data by time period
 */
export function aggregateByPeriod(
  data: DailyUsage[],
  period: 'day' | 'week' | 'month' = 'day'
): DailyUsage[] {
  if (period === 'day') return data;
  
  const grouped: Map<string, DailyUsage> = new Map();
  
  data.forEach(d => {
    const date = new Date(d.date);
    let key: string;
    
    if (period === 'week') {
      // Get the week start (Sunday)
      const day = date.getDay();
      const weekStart = new Date(date);
      weekStart.setDate(date.getDate() - day);
      key = weekStart.toISOString().split('T')[0];
    } else {
      // Month
      key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    }
    
    const existing = grouped.get(key);
    if (existing) {
      existing.calls += d.calls;
      existing.characters += d.characters;
    } else {
      grouped.set(key, { date: key, calls: d.calls, characters: d.characters });
    }
  });
  
  return Array.from(grouped.values()).sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Calculate summary statistics
 */
export function calculateStats(data: DailyUsage[]): {
  totalCalls: number;
  totalCharacters: number;
  avgCallsPerDay: number;
  peakDay: DailyUsage | null;
} {
  if (data.length === 0) {
    return { totalCalls: 0, totalCharacters: 0, avgCallsPerDay: 0, peakDay: null };
  }
  
  const totalCalls = data.reduce((sum, d) => sum + d.calls, 0);
  const totalCharacters = data.reduce((sum, d) => sum + d.characters, 0);
  const avgCallsPerDay = totalCalls / data.length;
  
  const peakDay = data.reduce((max, d) => d.calls > max.calls ? d : max, data[0]);
  
  return { totalCalls, totalCharacters, avgCallsPerDay, peakDay };
}