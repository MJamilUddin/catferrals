import { useEffect, useState } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useFetcher, useNavigate, useSearchParams } from "@remix-run/react";
import {
  Page,
  Layout,
  Text,
  Card,
  Button,
  BlockStack,
  Box,
  InlineStack,
  Badge,
  DataTable,
  Icon,
  Select,
  TextField,
  Tabs,
  ProgressBar,
  EmptyState,
  Tooltip,
  ButtonGroup,
  Divider,
  List,
  Frame,
  Toast,
} from "@shopify/polaris";
import { 
  ChartVerticalIcon,
  ShareIcon,
  OrderIcon,
  PersonIcon,
  ExportIcon,
  CalendarIcon,
  FilterIcon,
  SearchIcon,
  RefreshIcon,
  ArrowUpIcon,
  ArrowDownIcon
} from "@shopify/polaris-icons";
import { TitleBar, useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  
  const url = new URL(request.url);
  const timeRange = url.searchParams.get("timeRange") || "30";
  const programId = url.searchParams.get("programId") || "all";
  
  // Calculate date ranges
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(endDate.getDate() - parseInt(timeRange));
  
  const prevStartDate = new Date(startDate);
  prevStartDate.setDate(prevStartDate.getDate() - parseInt(timeRange));

  // Get programs for this shop
  const programs = await db.referralProgram.findMany({
    where: { shop: session.shop },
    include: {
      referrals: {
        include: {
          clicks: {
            where: {
              clickedAt: {
                gte: prevStartDate
              }
            }
          },
          referrerAccount: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true
            }
          }
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  });

  // Filter by program if specified
  const filteredPrograms = programId === "all" ? programs : programs.filter(p => p.id === programId);

  // Get all referrals for analysis
  const allReferrals = filteredPrograms.flatMap(p => p.referrals);
  
  // Calculate metrics for current period
  const currentPeriodReferrals = allReferrals.filter(r => r.createdAt >= startDate);
  const currentPeriodConversions = allReferrals.filter(r => r.convertedAt && r.convertedAt >= startDate);
  const currentPeriodClicks = allReferrals.flatMap(r => r.clicks).filter(c => c.clickedAt >= startDate);
  
  // Calculate metrics for previous period (for comparison)
  const prevPeriodReferrals = allReferrals.filter(r => 
    r.createdAt >= prevStartDate && r.createdAt < startDate
  );
  const prevPeriodConversions = allReferrals.filter(r => 
    r.convertedAt && r.convertedAt >= prevStartDate && r.convertedAt < startDate
  );
  const prevPeriodClicks = allReferrals.flatMap(r => r.clicks).filter(c => 
    c.clickedAt >= prevStartDate && c.clickedAt < startDate
  );

  // Current period metrics
  const currentMetrics = {
    totalReferrals: currentPeriodReferrals.length,
    totalClicks: currentPeriodClicks.length,
    totalConversions: currentPeriodConversions.length,
    totalRevenue: currentPeriodConversions.reduce((sum, r) => sum + (r.orderValue || 0), 0),
    totalCommissions: currentPeriodConversions.reduce((sum, r) => sum + (r.commissionAmount || 0), 0),
    conversionRate: currentPeriodClicks.length > 0 ? 
      ((currentPeriodConversions.length / currentPeriodClicks.length) * 100) : 0,
    avgOrderValue: currentPeriodConversions.length > 0 ?
      (currentPeriodConversions.reduce((sum, r) => sum + (r.orderValue || 0), 0) / currentPeriodConversions.length) : 0
  };

  // Previous period metrics for comparison
  const prevMetrics = {
    totalReferrals: prevPeriodReferrals.length,
    totalClicks: prevPeriodClicks.length,
    totalConversions: prevPeriodConversions.length,
    totalRevenue: prevPeriodConversions.reduce((sum, r) => sum + (r.orderValue || 0), 0),
    totalCommissions: prevPeriodConversions.reduce((sum, r) => sum + (r.commissionAmount || 0), 0),
    conversionRate: prevPeriodClicks.length > 0 ? 
      ((prevPeriodConversions.length / prevPeriodClicks.length) * 100) : 0,
    avgOrderValue: prevPeriodConversions.length > 0 ?
      (prevPeriodConversions.reduce((sum, r) => sum + (r.orderValue || 0), 0) / prevPeriodConversions.length) : 0
  };

  // Calculate percentage changes
  const calculateChange = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
  };

  const metricsWithChanges = {
    totalReferrals: {
      current: currentMetrics.totalReferrals,
      change: calculateChange(currentMetrics.totalReferrals, prevMetrics.totalReferrals)
    },
    totalClicks: {
      current: currentMetrics.totalClicks,
      change: calculateChange(currentMetrics.totalClicks, prevMetrics.totalClicks)
    },
    totalConversions: {
      current: currentMetrics.totalConversions,
      change: calculateChange(currentMetrics.totalConversions, prevMetrics.totalConversions)
    },
    totalRevenue: {
      current: currentMetrics.totalRevenue,
      change: calculateChange(currentMetrics.totalRevenue, prevMetrics.totalRevenue)
    },
    totalCommissions: {
      current: currentMetrics.totalCommissions,
      change: calculateChange(currentMetrics.totalCommissions, prevMetrics.totalCommissions)
    },
    conversionRate: {
      current: currentMetrics.conversionRate,
      change: calculateChange(currentMetrics.conversionRate, prevMetrics.conversionRate)
    },
    avgOrderValue: {
      current: currentMetrics.avgOrderValue,
      change: calculateChange(currentMetrics.avgOrderValue, prevMetrics.avgOrderValue)
    }
  };

  // Time series data (daily breakdown)
  const timeSeriesData = [];
  for (let i = parseInt(timeRange) - 1; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dayStart = new Date(date.setHours(0, 0, 0, 0));
    const dayEnd = new Date(date.setHours(23, 59, 59, 999));

    const dayReferrals = allReferrals.filter(r => 
      r.createdAt >= dayStart && r.createdAt <= dayEnd
    );
    const dayConversions = allReferrals.filter(r => 
      r.convertedAt && r.convertedAt >= dayStart && r.convertedAt <= dayEnd
    );
    const dayClicks = allReferrals.flatMap(r => r.clicks).filter(c => 
      c.clickedAt >= dayStart && c.clickedAt <= dayEnd
    );

    timeSeriesData.push({
      date: dayStart.toISOString().split('T')[0],
      referrals: dayReferrals.length,
      clicks: dayClicks.length,
      conversions: dayConversions.length,
      revenue: dayConversions.reduce((sum, r) => sum + (r.orderValue || 0), 0),
      commissions: dayConversions.reduce((sum, r) => sum + (r.commissionAmount || 0), 0)
    });
  }

  // Top referrers analysis
  const referrerPerformance = allReferrals.reduce((acc, referral) => {
    const key = referral.referrerAccountId || referral.referrerEmail;
    if (!acc[key]) {
      acc[key] = {
        id: referral.referrerAccountId,
        email: referral.referrerEmail,
        name: referral.referrerAccount ? 
          `${referral.referrerAccount.firstName || ''} ${referral.referrerAccount.lastName || ''}`.trim() :
          referral.referrerName || '',
        referrals: 0,
        clicks: 0,
        conversions: 0,
        revenue: 0,
        commissions: 0
      };
    }
    
    acc[key].referrals += 1;
    acc[key].clicks += referral.clickCount;
    if (referral.status === 'converted') {
      acc[key].conversions += 1;
      acc[key].revenue += referral.orderValue || 0;
      acc[key].commissions += referral.commissionAmount || 0;
    }
    
    return acc;
  }, {} as Record<string, any>);

  const topReferrers = Object.values(referrerPerformance)
    .sort((a: any, b: any) => b.revenue - a.revenue)
    .slice(0, 10);

  // Program performance comparison
  const programPerformance = programs.map(program => {
    const programReferrals = program.referrals.filter(r => r.createdAt >= startDate);
    const programConversions = program.referrals.filter(r => 
      r.convertedAt && r.convertedAt >= startDate
    );
    const programClicks = program.referrals.flatMap(r => r.clicks).filter(c => 
      c.clickedAt >= startDate
    );

    return {
      id: program.id,
      name: program.name,
      isActive: program.isActive,
      referrals: programReferrals.length,
      clicks: programClicks.length,
      conversions: programConversions.length,
      revenue: programConversions.reduce((sum, r) => sum + (r.orderValue || 0), 0),
      commissions: programConversions.reduce((sum, r) => sum + (r.commissionAmount || 0), 0),
      conversionRate: programClicks.length > 0 ? 
        ((programConversions.length / programClicks.length) * 100) : 0
    };
  });

  // Conversion funnel data
  const funnelData = {
    referralsCreated: currentMetrics.totalReferrals,
    linksClicked: currentMetrics.totalClicks,
    conversions: currentMetrics.totalConversions,
    paidCommissions: currentPeriodConversions.filter(r => r.commissionPaid).length
  };

  return json({
    metricsWithChanges,
    timeSeriesData,
    topReferrers,
    programPerformance,
    funnelData,
    programs: programs.map(p => ({ id: p.id, name: p.name })),
    timeRange,
    programId
  });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "export_data") {
    // In a real implementation, you'd generate CSV/PDF here
    return json({ success: true, message: "Export started - check your email" });
  }

  return json({ success: false });
};

export default function AnalyticsDashboard() {
  const { 
    metricsWithChanges, 
    timeSeriesData, 
    topReferrers, 
    programPerformance, 
    funnelData,
    programs,
    timeRange,
    programId
  } = useLoaderData<typeof loader>();
  
  const fetcher = useFetcher();
  const shopify = useAppBridge();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  const [selectedTab, setSelectedTab] = useState(0);
  const [selectedTimeRange, setSelectedTimeRange] = useState(timeRange);
  const [selectedProgram, setSelectedProgram] = useState(programId);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  // Handle filter changes
  const handleFilterChange = (newTimeRange?: string, newProgram?: string) => {
    const params = new URLSearchParams(searchParams);
    params.set("timeRange", newTimeRange || selectedTimeRange);
    params.set("programId", newProgram || selectedProgram);
    
    navigate({ search: params.toString() });
  };

  const handleExport = () => {
    fetcher.submit(
      { intent: "export_data" },
      { method: "POST" }
    );
    setToastMessage("Export started - data will be emailed to you");
    setShowToast(true);
  };

  const formatCurrency = (amount: number) => `$${amount.toFixed(2)}`;
  const formatPercentage = (value: number) => `${Math.abs(value).toFixed(1)}%`;
  const formatChange = (change: number) => ({
    value: formatPercentage(change),
    isPositive: change >= 0,
    icon: change >= 0 ? ArrowUpIcon : ArrowDownIcon
  });

  const tabs = [
    { id: 'overview', content: 'Overview' },
    { id: 'performance', content: 'Performance' },
    { id: 'referrers', content: 'Top Referrers' },
    { id: 'programs', content: 'Program Comparison' },
    { id: 'funnel', content: 'Conversion Funnel' }
  ];

  const renderOverviewTab = () => (
    <Layout>
      <Layout.Section>
        <BlockStack gap="400">
          {/* Key Metrics Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
            <Card>
              <BlockStack gap="200">
                <InlineStack align="space-between">
                  <Text as="h3" variant="headingMd">Total Referrals</Text>
                  <Icon source={ShareIcon} tone="base" />
                </InlineStack>
                <Text as="p" variant="heading2xl">{metricsWithChanges.totalReferrals.current}</Text>
                <InlineStack gap="100">
                  <Icon 
                    source={formatChange(metricsWithChanges.totalReferrals.change).icon} 
                    tone={formatChange(metricsWithChanges.totalReferrals.change).isPositive ? "success" : "critical"} 
                  />
                  <Text 
                    as="p" 
                    variant="bodyMd" 
                    tone={formatChange(metricsWithChanges.totalReferrals.change).isPositive ? "success" : "critical"}
                  >
                    {formatChange(metricsWithChanges.totalReferrals.change).value} from last period
                  </Text>
                </InlineStack>
              </BlockStack>
            </Card>

            <Card>
              <BlockStack gap="200">
                <InlineStack align="space-between">
                  <Text as="h3" variant="headingMd">Total Clicks</Text>
                  <Icon source={ChartVerticalIcon} tone="base" />
                </InlineStack>
                <Text as="p" variant="heading2xl">{metricsWithChanges.totalClicks.current}</Text>
                <InlineStack gap="100">
                  <Icon 
                    source={formatChange(metricsWithChanges.totalClicks.change).icon} 
                    tone={formatChange(metricsWithChanges.totalClicks.change).isPositive ? "success" : "critical"} 
                  />
                  <Text 
                    as="p" 
                    variant="bodyMd" 
                    tone={formatChange(metricsWithChanges.totalClicks.change).isPositive ? "success" : "critical"}
                  >
                    {formatChange(metricsWithChanges.totalClicks.change).value} from last period
                  </Text>
                </InlineStack>
              </BlockStack>
            </Card>

            <Card>
              <BlockStack gap="200">
                <InlineStack align="space-between">
                  <Text as="h3" variant="headingMd">Conversions</Text>
                  <Icon source={OrderIcon} tone="base" />
                </InlineStack>
                <Text as="p" variant="heading2xl">{metricsWithChanges.totalConversions.current}</Text>
                <InlineStack gap="100">
                  <Icon 
                    source={formatChange(metricsWithChanges.totalConversions.change).icon} 
                    tone={formatChange(metricsWithChanges.totalConversions.change).isPositive ? "success" : "critical"} 
                  />
                  <Text 
                    as="p" 
                    variant="bodyMd" 
                    tone={formatChange(metricsWithChanges.totalConversions.change).isPositive ? "success" : "critical"}
                  >
                    {formatChange(metricsWithChanges.totalConversions.change).value} from last period
                  </Text>
                </InlineStack>
              </BlockStack>
            </Card>

            <Card>
              <BlockStack gap="200">
                <InlineStack align="space-between">
                  <Text as="h3" variant="headingMd">Total Revenue</Text>
                  <Icon source={OrderIcon} tone="base" />
                </InlineStack>
                <Text as="p" variant="heading2xl">{formatCurrency(metricsWithChanges.totalRevenue.current)}</Text>
                <InlineStack gap="100">
                  <Icon 
                    source={formatChange(metricsWithChanges.totalRevenue.change).icon} 
                    tone={formatChange(metricsWithChanges.totalRevenue.change).isPositive ? "success" : "critical"} 
                  />
                  <Text 
                    as="p" 
                    variant="bodyMd" 
                    tone={formatChange(metricsWithChanges.totalRevenue.change).isPositive ? "success" : "critical"}
                  >
                    {formatChange(metricsWithChanges.totalRevenue.change).value} from last period
                  </Text>
                </InlineStack>
              </BlockStack>
            </Card>

            <Card>
              <BlockStack gap="200">
                <InlineStack align="space-between">
                  <Text as="h3" variant="headingMd">Conversion Rate</Text>
                  <Icon source={ChartVerticalIcon} tone="base" />
                </InlineStack>
                <Text as="p" variant="heading2xl">{formatPercentage(metricsWithChanges.conversionRate.current)}</Text>
                <InlineStack gap="100">
                  <Icon 
                    source={formatChange(metricsWithChanges.conversionRate.change).icon} 
                    tone={formatChange(metricsWithChanges.conversionRate.change).isPositive ? "success" : "critical"} 
                  />
                  <Text 
                    as="p" 
                    variant="bodyMd" 
                    tone={formatChange(metricsWithChanges.conversionRate.change).isPositive ? "success" : "critical"}
                  >
                    {formatChange(metricsWithChanges.conversionRate.change).value} from last period
                  </Text>
                </InlineStack>
              </BlockStack>
            </Card>

            <Card>
              <BlockStack gap="200">
                <InlineStack align="space-between">
                  <Text as="h3" variant="headingMd">Avg Order Value</Text>
                  <Icon source={OrderIcon} tone="base" />
                </InlineStack>
                <Text as="p" variant="heading2xl">{formatCurrency(metricsWithChanges.avgOrderValue.current)}</Text>
                <InlineStack gap="100">
                  <Icon 
                    source={formatChange(metricsWithChanges.avgOrderValue.change).icon} 
                    tone={formatChange(metricsWithChanges.avgOrderValue.change).isPositive ? "success" : "critical"} 
                  />
                  <Text 
                    as="p" 
                    variant="bodyMd" 
                    tone={formatChange(metricsWithChanges.avgOrderValue.change).isPositive ? "success" : "critical"}
                  >
                    {formatChange(metricsWithChanges.avgOrderValue.change).value} from last period
                  </Text>
                </InlineStack>
              </BlockStack>
            </Card>
          </div>

          {/* Quick Insights */}
          <Card>
            <BlockStack gap="300">
              <Text as="h2" variant="headingMd">Key Insights</Text>
              <List>
                <List.Item>
                  {metricsWithChanges.conversionRate.change >= 0 ? 
                    `Conversion rate improved by ${formatPercentage(metricsWithChanges.conversionRate.change)}` :
                    `Conversion rate decreased by ${formatPercentage(metricsWithChanges.conversionRate.change)}`
                  }
                </List.Item>
                <List.Item>
                  Best performing program: {programPerformance.length > 0 ? 
                    programPerformance.sort((a, b) => b.revenue - a.revenue)[0]?.name || 'None' : 'None'
                  }
                </List.Item>
                <List.Item>
                  Top referrer generated: {topReferrers.length > 0 ? 
                    formatCurrency(topReferrers[0]?.revenue || 0) : '$0.00'
                  } in revenue
                </List.Item>
                <List.Item>
                  {metricsWithChanges.totalRevenue.change >= 0 ? 
                    `Revenue increased by ${formatCurrency(metricsWithChanges.totalRevenue.current - (metricsWithChanges.totalRevenue.current / (1 + metricsWithChanges.totalRevenue.change / 100)))}` :
                    `Revenue decreased by ${formatCurrency((metricsWithChanges.totalRevenue.current / (1 + metricsWithChanges.totalRevenue.change / 100)) - metricsWithChanges.totalRevenue.current)}`
                  }
                </List.Item>
              </List>
            </BlockStack>
          </Card>
        </BlockStack>
      </Layout.Section>
    </Layout>
  );

  const renderPerformanceTab = () => (
    <Layout>
      <Layout.Section>
        <Card>
          <BlockStack gap="400">
            <Text as="h2" variant="headingMd">Performance Trends</Text>
            
            {/* Time Series Chart Simulation */}
            <Box background="bg-surface-secondary" padding="400" borderRadius="200">
              <BlockStack gap="300">
                <Text as="h3" variant="headingMd">Daily Performance Chart</Text>
                <Text as="p" variant="bodyMd" tone="subdued">
                  Interactive chart showing referrals, clicks, and conversions over time
                </Text>
                
                {/* Simple chart representation */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(60px, 1fr))', gap: '8px', marginTop: '20px' }}>
                  {timeSeriesData.slice(-7).map((day, index) => (
                    <Box key={day.date} padding="200" background="bg-surface" borderRadius="100">
                      <BlockStack gap="100" align="center">
                        <Text as="p" variant="bodyMd">{new Date(day.date).toLocaleDateString('en-US', { weekday: 'short' })}</Text>
                        <div style={{ 
                          height: `${Math.max(20, (day.conversions / Math.max(...timeSeriesData.map(d => d.conversions), 1)) * 60)}px`,
                          width: '20px',
                          backgroundColor: '#007ace',
                          borderRadius: '2px'
                        }} />
                        <Text as="p" variant="bodyMd">{day.conversions}</Text>
                      </BlockStack>
                    </Box>
                  ))}
                </div>
              </BlockStack>
            </Box>

            {/* Performance Table */}
            <DataTable
              columnContentTypes={['text', 'numeric', 'numeric', 'numeric', 'text']}
              headings={['Date', 'Referrals', 'Clicks', 'Conversions', 'Revenue']}
              rows={timeSeriesData.slice(-10).reverse().map(day => [
                new Date(day.date).toLocaleDateString(),
                day.referrals.toString(),
                day.clicks.toString(),
                day.conversions.toString(),
                formatCurrency(day.revenue)
              ])}
            />
          </BlockStack>
        </Card>
      </Layout.Section>
    </Layout>
  );

  const renderReferrersTab = () => (
    <Layout>
      <Layout.Section>
        <Card>
          <BlockStack gap="300">
            <InlineStack align="space-between">
              <Text as="h2" variant="headingMd">Top Performing Referrers</Text>
              <Button icon={ExportIcon} onClick={handleExport}>
                Export
              </Button>
            </InlineStack>
            
            {topReferrers.length === 0 ? (
              <EmptyState
                heading="No referrer data available"
                image=""
              >
                <Text as="p">Start collecting referral data to see top performer insights.</Text>
              </EmptyState>
            ) : (
              <DataTable
                columnContentTypes={['text', 'text', 'numeric', 'numeric', 'numeric', 'text', 'text']}
                headings={['Name', 'Email', 'Referrals', 'Clicks', 'Conversions', 'Revenue', 'Commissions']}
                rows={topReferrers.map(referrer => [
                  referrer.name || '-',
                  referrer.email,
                  referrer.referrals.toString(),
                  referrer.clicks.toString(),
                  referrer.conversions.toString(),
                  formatCurrency(referrer.revenue),
                  formatCurrency(referrer.commissions)
                ])}
              />
            )}
          </BlockStack>
        </Card>
      </Layout.Section>
    </Layout>
  );

  const renderProgramsTab = () => (
    <Layout>
      <Layout.Section>
        <Card>
          <BlockStack gap="300">
            <Text as="h2" variant="headingMd">Program Performance Comparison</Text>
            
            {programPerformance.length === 0 ? (
              <EmptyState
                heading="No program data available"
                image=""
              >
                <Text as="p">Create referral programs to see performance comparisons.</Text>
              </EmptyState>
            ) : (
              <DataTable
                columnContentTypes={['text', 'text', 'numeric', 'numeric', 'numeric', 'text', 'text', 'text']}
                headings={['Program', 'Status', 'Referrals', 'Clicks', 'Conversions', 'Conv. Rate', 'Revenue', 'Commissions']}
                rows={programPerformance.map(program => [
                  program.name,
                  program.isActive ? 'Active' : 'Inactive',
                  program.referrals.toString(),
                  program.clicks.toString(),
                  program.conversions.toString(),
                  formatPercentage(program.conversionRate),
                  formatCurrency(program.revenue),
                  formatCurrency(program.commissions)
                ])}
              />
            )}
          </BlockStack>
        </Card>
      </Layout.Section>
    </Layout>
  );

  const renderFunnelTab = () => (
    <Layout>
      <Layout.Section>
        <Card>
          <BlockStack gap="400">
            <Text as="h2" variant="headingMd">Conversion Funnel Analysis</Text>
            
            <div style={{ display: 'grid', gap: '16px' }}>
              {/* Funnel Steps */}
              <Box padding="300" background="bg-surface-secondary" borderRadius="200">
                <BlockStack gap="200">
                  <InlineStack align="space-between">
                    <Text as="h3" variant="headingMd">1. Referrals Created</Text>
                    <Text as="p" variant="heading2xl">{funnelData.referralsCreated}</Text>
                  </InlineStack>
                  <ProgressBar progress={100} />
                  <Text as="p" variant="bodyMd" tone="subdued">Starting point of referral journey</Text>
                </BlockStack>
              </Box>

              <Box padding="300" background="bg-surface-secondary" borderRadius="200">
                <BlockStack gap="200">
                  <InlineStack align="space-between">
                    <Text as="h3" variant="headingMd">2. Links Clicked</Text>
                    <Text as="p" variant="heading2xl">{funnelData.linksClicked}</Text>
                  </InlineStack>
                  <ProgressBar 
                    progress={funnelData.referralsCreated > 0 ? 
                      (funnelData.linksClicked / funnelData.referralsCreated) * 100 : 0
                    } 
                  />
                  <Text as="p" variant="bodyMd" tone="subdued">
                    {funnelData.referralsCreated > 0 ? 
                      formatPercentage((funnelData.linksClicked / funnelData.referralsCreated) * 100) : '0%'
                    } of referrals generated clicks
                  </Text>
                </BlockStack>
              </Box>

              <Box padding="300" background="bg-surface-secondary" borderRadius="200">
                <BlockStack gap="200">
                  <InlineStack align="space-between">
                    <Text as="h3" variant="headingMd">3. Conversions</Text>
                    <Text as="p" variant="heading2xl">{funnelData.conversions}</Text>
                  </InlineStack>
                  <ProgressBar 
                    progress={funnelData.linksClicked > 0 ? 
                      (funnelData.conversions / funnelData.linksClicked) * 100 : 0
                    } 
                  />
                  <Text as="p" variant="bodyMd" tone="subdued">
                    {funnelData.linksClicked > 0 ? 
                      formatPercentage((funnelData.conversions / funnelData.linksClicked) * 100) : '0%'
                    } of clicks converted
                  </Text>
                </BlockStack>
              </Box>

              <Box padding="300" background="bg-surface-secondary" borderRadius="200">
                <BlockStack gap="200">
                  <InlineStack align="space-between">
                    <Text as="h3" variant="headingMd">4. Commissions Paid</Text>
                    <Text as="p" variant="heading2xl">{funnelData.paidCommissions}</Text>
                  </InlineStack>
                  <ProgressBar 
                    progress={funnelData.conversions > 0 ? 
                      (funnelData.paidCommissions / funnelData.conversions) * 100 : 0
                    } 
                  />
                  <Text as="p" variant="bodyMd" tone="subdued">
                    {funnelData.conversions > 0 ? 
                      formatPercentage((funnelData.paidCommissions / funnelData.conversions) * 100) : '0%'
                    } of conversions paid out
                  </Text>
                </BlockStack>
              </Box>
            </div>

            {/* Funnel Insights */}
            <Card>
              <BlockStack gap="200">
                <Text as="h3" variant="headingMd">Optimization Opportunities</Text>
                <List>
                  <List.Item>
                    {funnelData.referralsCreated > 0 && funnelData.linksClicked / funnelData.referralsCreated < 0.3 ?
                      "Low click-through rate - consider improving referral messaging" :
                      "Good referral engagement - referrers are actively sharing links"
                    }
                  </List.Item>
                  <List.Item>
                    {funnelData.linksClicked > 0 && funnelData.conversions / funnelData.linksClicked < 0.1 ?
                      "Low conversion rate - optimize landing page or offer" :
                      "Strong conversion performance - good offer-market fit"
                    }
                  </List.Item>
                  <List.Item>
                    {funnelData.conversions > 0 && funnelData.paidCommissions / funnelData.conversions < 0.8 ?
                      "Pending commission payouts - consider automated payments" :
                      "Good commission payment rate"
                    }
                  </List.Item>
                </List>
              </BlockStack>
            </Card>
          </BlockStack>
        </Card>
      </Layout.Section>
    </Layout>
  );

  return (
    <Frame>
      <Page
        title="Analytics Dashboard"
        subtitle="Comprehensive insights into your referral program performance"
        primaryAction={{
          content: 'Export Report',
          icon: ExportIcon,
          onAction: handleExport
        }}
        secondaryActions={[
          {
            content: 'Refresh Data',
            icon: RefreshIcon,
            onAction: () => window.location.reload()
          }
        ]}
      >
        {/* Filters */}
        <Layout>
          <Layout.Section>
            <Card>
              <InlineStack gap="300">
                <Select
                  label="Time Range"
                  options={[
                    { label: 'Last 7 days', value: '7' },
                    { label: 'Last 30 days', value: '30' },
                    { label: 'Last 90 days', value: '90' },
                    { label: 'Last 365 days', value: '365' }
                  ]}
                  value={selectedTimeRange}
                  onChange={(value) => {
                    setSelectedTimeRange(value);
                    handleFilterChange(value, undefined);
                  }}
                />
                
                <Select
                  label="Program"
                  options={[
                    { label: 'All Programs', value: 'all' },
                    ...programs.map(p => ({ label: p.name, value: p.id }))
                  ]}
                  value={selectedProgram}
                  onChange={(value) => {
                    setSelectedProgram(value);
                    handleFilterChange(undefined, value);
                  }}
                />
              </InlineStack>
            </Card>
          </Layout.Section>
        </Layout>

        {/* Main Content */}
        <Tabs tabs={tabs} selected={selectedTab} onSelect={setSelectedTab}>
          <Box paddingBlockStart="400">
            {selectedTab === 0 && renderOverviewTab()}
            {selectedTab === 1 && renderPerformanceTab()}
            {selectedTab === 2 && renderReferrersTab()}
            {selectedTab === 3 && renderProgramsTab()}
            {selectedTab === 4 && renderFunnelTab()}
          </Box>
        </Tabs>
      </Page>

      {/* Toast */}
      {showToast && (
        <Toast
          content={toastMessage}
          onDismiss={() => setShowToast(false)}
        />
      )}
    </Frame>
  );
} 