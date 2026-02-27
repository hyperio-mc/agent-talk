<script>
  import { 
    formatChartDate, 
    calculateScales, 
    generateLinePath, 
    generateAreaPath, 
    generateYTicks,
    defaultChartConfig,
    calculateStats
  } from './charts.js';
  
  export let data = [];
  export let days = 7;
  export let width = 600;
  export let height = 300;
  
  $: config = { ...defaultChartConfig, width, height };
  $: scales = calculateScales(data, config);
  $: yTicks = generateYTicks(scales.maxValue, config, 4);
  $: callsPath = generateLinePath(data, scales.xScale, scales.yScale, 'calls');
  $: callsArea = generateAreaPath(data, scales.xScale, scales.yScale, config, 'calls');
  $: stats = calculateStats(data);
  
  function formatNumber(num) {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  }
</script>

<div class="usage-chart">
  <div class="chart-header">
    <h3>Usage Overview</h3>
    <div class="period-label">Last {days} days</div>
  </div>
  
  {#if data.length === 0}
    <div class="empty-state">
      <p>No usage data yet</p>
      <p class="hint">Make your first API call to see usage here</p>
    </div>
  {:else}
    <div class="chart-container">
      <svg viewBox="0 0 {width} {height}" class="chart-svg">
        <!-- Grid lines -->
        {#each yTicks as tick}
          <line
            x1={config.padding}
            y1={tick.y}
            x2={width - config.padding}
            y2={tick.y}
            stroke={config.colors.grid}
            stroke-dasharray="4,4"
          />
          <text
            x={config.padding - 10}
            y={tick.y}
            text-anchor="end"
            fill={config.colors.text}
            font-size="12"
            dominant-baseline="middle"
          >
            {tick.label}
          </text>
        {/each}
        
        <!-- Area fill -->
        <path
          d={callsArea}
          fill={config.colors.primary}
          fill-opacity="0.1"
        />
        
        <!-- Line -->
        <path
          d={callsPath}
          fill="none"
          stroke={config.colors.primary}
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
        
        <!-- Data points -->
        {#each data as d, i}
          <circle
            cx={scales.xScale(i)}
            cy={scales.yScale(d.calls)}
            r="4"
            fill={config.colors.primary}
          />
        {/each}
        
        <!-- X-axis labels (show every nth label based on data length) -->
        {#each data as d, i}
          {#if data.length <= 7 || i % Math.ceil(data.length / 7) === 0}
            <text
              x={scales.xScale(i)}
              y={height - 10}
              text-anchor="middle"
              fill={config.colors.text}
              font-size="11"
            >
              {formatChartDate(d.date)}
            </text>
          {/if}
        {/each}
      </svg>
    </div>
    
    <div class="chart-stats">
      <div class="stat">
        <span class="stat-value">{formatNumber(stats.totalCalls)}</span>
        <span class="stat-label">Total Calls</span>
      </div>
      <div class="stat">
        <span class="stat-value">{formatNumber(stats.totalCharacters)}</span>
        <span class="stat-label">Characters</span>
      </div>
      <div class="stat">
        <span class="stat-value">{stats.avgCallsPerDay.toFixed(1)}</span>
        <span class="stat-label">Avg/Day</span>
      </div>
      {#if stats.peakDay}
        <div class="stat">
          <span class="stat-value">{stats.peakDay.calls}</span>
          <span class="stat-label">Peak ({formatChartDate(stats.peakDay.date)})</span>
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .usage-chart {
    background: white;
    border-radius: 12px;
    padding: 1.5rem;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  }
  
  .chart-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
  }
  
  .chart-header h3 {
    margin: 0;
    font-size: 1.125rem;
    font-weight: 600;
    color: #111827;
  }
  
  .period-label {
    font-size: 0.875rem;
    color: #6b7280;
  }
  
  .chart-container {
    width: 100%;
    overflow-x: auto;
  }
  
  .chart-svg {
    display: block;
    max-width: 100%;
    height: auto;
  }
  
  .chart-stats {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 1rem;
    margin-top: 1.5rem;
    padding-top: 1.5rem;
    border-top: 1px solid #e5e7eb;
  }
  
  .stat {
    text-align: center;
  }
  
  .stat-value {
    display: block;
    font-size: 1.5rem;
    font-weight: 700;
    color: #111827;
  }
  
  .stat-label {
    font-size: 0.75rem;
    color: #6b7280;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  
  .empty-state {
    text-align: center;
    padding: 3rem 1rem;
    color: #6b7280;
  }
  
  .empty-state p {
    margin: 0;
  }
  
  .empty-state .hint {
    margin-top: 0.5rem;
    font-size: 0.875rem;
    color: #9ca3af;
  }
  
  @media (max-width: 480px) {
    .chart-stats {
      grid-template-columns: repeat(2, 1fr);
    }
  }
</style>