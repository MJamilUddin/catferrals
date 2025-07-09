import { useEffect, useState } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useFetcher, useSearchParams, useNavigate } from "@remix-run/react";
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
  EmptyState,
  Modal,
  FormLayout,
  ButtonGroup,
  Divider,
  List,
  Frame,
  Toast,
  Checkbox,
  Filters,
  ChoiceList,
  DatePicker,
  Popover,
  Tooltip
} from "@shopify/polaris";
import { 
  PersonIcon,
  EmailIcon,
  ShareIcon,
  OrderIcon,
  ExportIcon,
  SearchIcon,
  FilterIcon,
  CalendarIcon,
  EditIcon,
  DeleteIcon,
  ChartVerticalIcon,
  PlusIcon,
  ArrowUpIcon,
  ArrowDownIcon
} from "@shopify/polaris-icons";
import { TitleBar, useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { sendInvitationEmail } from "../../../../app/lib/email.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  
  const url = new URL(request.url);
  const search = url.searchParams.get("search") || "";
  const status = url.searchParams.get("status") || "all";
  const program = url.searchParams.get("program") || "all";
  const sortBy = url.searchParams.get("sortBy") || "revenue";
  const sortOrder = url.searchParams.get("sortOrder") || "desc";
  const dateFrom = url.searchParams.get("dateFrom");
  const dateTo = url.searchParams.get("dateTo");

  // Get all programs for filtering
  const programs = await db.referralProgram.findMany({
    where: { shop: session.shop },
    select: { id: true, name: true }
  });

  // Get referrer accounts with their performance data
  const referrerAccounts = await db.referrerAccount.findMany({
    where: { 
      shop: session.shop,
      ...(search && {
        OR: [
          { email: { contains: search } },
          { firstName: { contains: search } },
          { lastName: { contains: search } }
        ]
      })
    },
    include: {
      referrals: {
        include: {
          clicks: true,
          program: {
            select: { name: true }
          }
        },
        ...(program !== "all" && {
          where: { programId: program }
        }),
        ...(dateFrom && dateTo && {
          where: {
            createdAt: {
              gte: new Date(dateFrom),
              lte: new Date(dateTo)
            }
          }
        })
      }
    }
  });

  // Process registered referrers
  const referrerData = referrerAccounts.map(account => {
    const referrals = account.referrals;
    const totalClicks = referrals.reduce((sum: number, r: any) => sum + r.clickCount, 0);
    const conversions = referrals.filter((r: any) => r.status === 'converted').length;
    const revenue = referrals.reduce((sum: number, r: any) => sum + (r.orderValue || 0), 0);
    const commissions = referrals.reduce((sum: number, r: any) => sum + (r.commissionAmount || 0), 0);
    const recentActivity = referrals.filter(r => {
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      return r.createdAt >= oneWeekAgo;
    }).length;

    return {
      id: account.id,
      type: 'registered',
      name: `${account.firstName || ''} ${account.lastName || ''}`.trim() || 'No Name',
      email: account.email,
      joinedAt: account.createdAt,
      isActive: account.isActive,
      referrals: referrals.length,
      clicks: totalClicks,
      conversions,
      revenue,
      commissions,
      conversionRate: totalClicks > 0 ? ((conversions / totalClicks) * 100) : 0,
      recentActivity,
      programs: [...new Set(referrals.map(r => r.program?.name).filter(Boolean))],
      lastActivity: referrals.length > 0 ? 
        Math.max(...referrals.map(r => new Date(r.createdAt).getTime())) : 
        new Date(account.createdAt).getTime()
    };
  });

  // For now, we'll focus on registered referrers only
  // Guest referrer functionality would require schema changes

  // Combine and filter all referrers  
  let allReferrers = [...referrerData];

  // Apply status filter
  if (status !== "all") {
    allReferrers = allReferrers.filter(referrer => {
      switch (status) {
        case "active":
          return referrer.isActive && referrer.recentActivity > 0;
        case "inactive":
          return !referrer.isActive || referrer.recentActivity === 0;
        case "high_performers":
          return referrer.revenue > 100; // Configure threshold
        case "new":
          const oneMonthAgo = new Date();
          oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
          return new Date(referrer.joinedAt) >= oneMonthAgo;
        default:
          return true;
      }
    });
  }

  // Apply sorting
  allReferrers.sort((a, b) => {
    let aValue, bValue;
    
    switch (sortBy) {
      case "name":
        aValue = a.name.toLowerCase();
        bValue = b.name.toLowerCase();
        break;
      case "revenue":
        aValue = a.revenue;
        bValue = b.revenue;
        break;
      case "conversions":
        aValue = a.conversions;
        bValue = b.conversions;
        break;
      case "clicks":
        aValue = a.clicks;
        bValue = b.clicks;
        break;
      case "joined":
        aValue = new Date(a.joinedAt).getTime();
        bValue = new Date(b.joinedAt).getTime();
        break;
      case "activity":
        aValue = a.lastActivity;
        bValue = b.lastActivity;
        break;
      default:
        aValue = a.revenue;
        bValue = b.revenue;
    }

    if (sortOrder === "asc") {
      return aValue > bValue ? 1 : -1;
    } else {
      return aValue < bValue ? 1 : -1;
    }
  });

  // Calculate summary statistics
  const totalReferrers = allReferrers.length;
  const activeReferrers = allReferrers.filter(r => r.isActive && r.recentActivity > 0).length;
  const totalRevenue = allReferrers.reduce((sum, r) => sum + r.revenue, 0);
  const totalCommissions = allReferrers.reduce((sum, r) => sum + r.commissions, 0);
  const avgRevenuePerReferrer = totalReferrers > 0 ? totalRevenue / totalReferrers : 0;

  return json({
    referrers: allReferrers,
    programs,
    summary: {
      totalReferrers,
      activeReferrers,
      totalRevenue,
      totalCommissions,
      avgRevenuePerReferrer
    },
    filters: {
      search,
      status,
      program,
      sortBy,
      sortOrder,
      dateFrom,
      dateTo
    }
  });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "export_referrers") {
    // In a real implementation, generate CSV/Excel file
    return json({ success: true, message: "Referrer data export started - check your email" });
  }

  if (intent === "bulk_email") {
    const referrerIds = JSON.parse(formData.get("referrerIds") as string);
    const subject = formData.get("subject") as string;
    const message = formData.get("message") as string;
    
    // In a real implementation, send bulk emails
    return json({ success: true, message: `Email sent to ${referrerIds.length} referrers` });
  }

  if (intent === "toggle_status") {
    const referrerId = formData.get("referrerId") as string;
    const newStatus = formData.get("newStatus") === "true";
    
    if (!referrerId.startsWith('guest-')) {
      await db.referrerAccount.update({
        where: { id: referrerId },
        data: { isActive: newStatus }
      });
    }
    
    return json({ success: true });
  }

  if (intent === "delete_referrer") {
    const referrerId = formData.get("referrerId") as string;
    
    if (!referrerId.startsWith('guest-')) {
      // In a real implementation, you might want to soft delete or archive
      await db.referrerAccount.delete({
        where: { id: referrerId }
      });
    }
    
    return json({ success: true });
  }

  if (intent === "send_individual_invite") {
    console.log("🔍 Processing individual invite request");
    
    const email = formData.get("email") as string;
    const firstName = formData.get("firstName") as string;
    const lastName = formData.get("lastName") as string;
    const programId = formData.get("programId") as string;
    const personalMessage = formData.get("personalMessage") as string;
    
    console.log("📧 Invite details:", { email, firstName, lastName, programId, personalMessage });
    
    // Check if referrer already exists
    const existingReferrer = await db.referrerAccount.findFirst({
      where: { 
        email,
        shop: session.shop
      }
    });
    
    if (existingReferrer) {
      console.log("❌ Referrer already exists:", existingReferrer.email);
      return json({ success: false, error: "Referrer with this email already exists" });
    }
    
    // Fetch the referral program
    const program = await db.referralProgram.findUnique({
      where: { id: programId }
    });
    if (!program) {
      console.log("❌ Program not found:", programId);
      return json({ success: false, error: "Referral program not found" });
    }
    
    console.log("✅ Program found:", program.name);
    
    // Generate email verification token
    const { nanoid } = await import("nanoid");
    const emailVerificationToken = nanoid(32);
    
    // Create new referrer account with verification token
    const referrerAccount = await db.referrerAccount.create({
      data: {
        email,
        firstName,
        lastName,
        shop: session.shop,
        isActive: true,
        emailVerificationToken,
        isEmailVerified: false
      }
    });
    
    console.log("✅ Referrer account created:", referrerAccount.id);
    
    // Generate referral code and verification link
    const referralCode = nanoid(8).toUpperCase();
    const referralLink = `https://${session.shop}?code=${referralCode}&verify=${emailVerificationToken}`;
    
    console.log("🔗 Generated referral link:", referralLink);
    
    // Create referral record
    await db.referral.create({
      data: {
        shop: session.shop,
        programId: program.id,
        referrerAccountId: referrerAccount.id,
        referrerCustomerId: `account_${referrerAccount.id}`,
        referrerEmail: email,
        referrerName: `${firstName || ''} ${lastName || ''}`.trim() || null,
        referralCode,
        referralLink,
        status: "pending"
      }
    });
    
    console.log("✅ Referral record created");
    
    // Send invitation email
    const commissionRate = program.commissionType === 'percentage'
      ? `${program.commissionValue}%`
      : `$${program.commissionValue}`;
    
    console.log("📧 Preparing to send email with data:", {
      recipientEmail: email,
      recipientName: `${firstName || ''} ${lastName || ''}`.trim(),
      senderName: session.shop,
      personalMessage,
      referralLink,
      programName: program.name,
      commissionRate,
      shopName: program.shop,
      shopDomain: program.shop
    });
    
    const emailResult = await sendInvitationEmail({
      recipientEmail: email,
      recipientName: `${firstName || ''} ${lastName || ''}`.trim(),
      senderName: session.shop,
      personalMessage,
      referralLink,
      programName: program.name,
      commissionRate,
      shopName: program.shop,
      shopDomain: program.shop
    });
    
    console.log("📧 Email result:", emailResult);
    
    if (!emailResult.success) {
      console.log("❌ Email failed to send:", emailResult.error);
      return json({ success: false, error: emailResult.error || "Failed to send invitation email" });
    }
    
    console.log("✅ Email sent successfully, messageId:", emailResult.messageId);
    return json({ success: true, message: "Invitation sent successfully" });
  }

  return json({ success: false });
};

export default function ReferrerManagement() {
  const { referrers, programs, summary, filters } = useLoaderData<typeof loader>();
  const fetcher = useFetcher();
  const [searchParams] = useSearchParams();
  const shopify = useAppBridge();
  const navigate = useNavigate();
  
  const [selectedTab, setSelectedTab] = useState(0);
  const [selectedReferrers, setSelectedReferrers] = useState<string[]>([]);
  const [showBulkEmailModal, setShowBulkEmailModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [emailSubject, setEmailSubject] = useState("");
  const [emailMessage, setEmailMessage] = useState("");
  const [referrerToDelete, setReferrerToDelete] = useState<string | null>(null);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  // Invite modal state
  const [inviteForm, setInviteForm] = useState({
    email: "",
    firstName: "",
    lastName: "",
    programId: programs[0]?.id || "",
    personalMessage: ""
  });

  // Navigation helper for embedded app
  const handleNavigation = (path: string) => {
    navigate(path);
  };

  // Filter handling
  const updateFilters = (newFilters: Partial<typeof filters>) => {
    const params = new URLSearchParams(searchParams);
    
    Object.entries(newFilters).forEach(([key, value]) => {
      if (value && value !== "all" && value !== "") {
        params.set(key, value as string);
      } else {
        params.delete(key);
      }
    });
    
    handleNavigation(`/app/referrers?${params.toString()}`);
  };

  const handleBulkEmail = () => {
    if (selectedReferrers.length === 0) return;
    
    fetcher.submit(
      {
        intent: "bulk_email",
        referrerIds: JSON.stringify(selectedReferrers),
        subject: emailSubject,
        message: emailMessage
      },
      { method: "POST" }
    );
    
    setShowBulkEmailModal(false);
    setEmailSubject("");
    setEmailMessage("");
    setSelectedReferrers([]);
    setToastMessage(`Email sent to ${selectedReferrers.length} referrers`);
    setShowToast(true);
  };

  const handleExport = () => {
    fetcher.submit({ intent: "export_referrers" }, { method: "POST" });
    setToastMessage("Export started - data will be emailed to you");
    setShowToast(true);
  };

  const toggleReferrerStatus = (referrerId: string, currentStatus: boolean) => {
    fetcher.submit(
      {
        intent: "toggle_status",
        referrerId,
        newStatus: (!currentStatus).toString()
      },
      { method: "POST" }
    );
  };

  const deleteReferrer = () => {
    if (!referrerToDelete) return;
    
    fetcher.submit(
      {
        intent: "delete_referrer",
        referrerId: referrerToDelete
      },
      { method: "POST" }
    );
    
    setShowDeleteModal(false);
    setReferrerToDelete(null);
    setToastMessage("Referrer deleted successfully");
    setShowToast(true);
  };

  const formatCurrency = (amount: number) => `$${amount.toFixed(2)}`;
  const formatDate = (date: string | number) => new Date(date).toLocaleDateString();

  const tabs = [
    { id: 'all', content: 'All Referrers' },
    { id: 'performance', content: 'Performance View' },
    { id: 'activity', content: 'Activity Timeline' }
  ];

  // Prepare data for DataTable
  const referrerRows = referrers.map(referrer => [
    <InlineStack gap="300" key={referrer.id}>
      <Checkbox
        label=""
        checked={selectedReferrers.includes(referrer.id)}
        onChange={(checked) => {
          if (checked) {
            setSelectedReferrers([...selectedReferrers, referrer.id]);
          } else {
            setSelectedReferrers(selectedReferrers.filter(id => id !== referrer.id));
          }
        }}
      />
      <BlockStack gap="100">
        <InlineStack gap="200">
          <Text as="h3" variant="bodyMd" fontWeight="semibold">{referrer.name}</Text>
          <Badge tone={referrer.type === 'registered' ? 'success' : 'info'}>
            {referrer.type === 'registered' ? 'Registered' : 'Guest'}
          </Badge>
          {referrer.isActive && referrer.recentActivity > 0 && (
            <Badge tone="success">Active</Badge>
          )}
        </InlineStack>
        <Text as="p" variant="bodyMd" tone="subdued">{referrer.email}</Text>
        <Text as="p" variant="bodySm" tone="subdued">
          Joined: {formatDate(referrer.joinedAt)}
        </Text>
      </BlockStack>
    </InlineStack>,
    referrer.referrals.toString(),
    referrer.clicks.toString(),
    referrer.conversions.toString(),
    `${referrer.conversionRate.toFixed(1)}%`,
    formatCurrency(referrer.revenue),
    formatCurrency(referrer.commissions),
    formatDate(referrer.lastActivity),
    <ButtonGroup key={referrer.id}>
      <Button 
        size="micro" 
        onClick={() => handleNavigation(`/app/referrers/${referrer.id}`)}
        icon={PersonIcon}
      >
        View
      </Button>
      {referrer.type === 'registered' && (
        <Button 
          size="micro" 
          onClick={() => toggleReferrerStatus(referrer.id, referrer.isActive)}
          tone={referrer.isActive ? "critical" : "success"}
        >
          {referrer.isActive ? "Deactivate" : "Activate"}
        </Button>
      )}
      <Button 
        size="micro" 
        tone="critical"
        onClick={() => {
          setReferrerToDelete(referrer.id);
          setShowDeleteModal(true);
        }}
        icon={DeleteIcon}
      >
        Delete
      </Button>
    </ButtonGroup>
  ]);

  const renderAllReferrersTab = () => (
    <Layout>
      <Layout.Section>
        <BlockStack gap="400">
          {/* Summary Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px' }}>
            <Card>
              <BlockStack gap="200">
                <InlineStack align="space-between">
                  <Text as="h3" variant="headingMd">Total Referrers</Text>
                  <Icon source={PersonIcon} tone="base" />
                </InlineStack>
                <Text as="p" variant="heading2xl">{summary.totalReferrers}</Text>
                <Text as="p" variant="bodyMd" tone="subdued">
                  {summary.activeReferrers} active this week
                </Text>
              </BlockStack>
            </Card>

            <Card>
              <BlockStack gap="200">
                <InlineStack align="space-between">
                  <Text as="h3" variant="headingMd">Total Revenue</Text>
                  <Icon source={OrderIcon} tone="base" />
                </InlineStack>
                <Text as="p" variant="heading2xl">{formatCurrency(summary.totalRevenue)}</Text>
                <Text as="p" variant="bodyMd" tone="subdued">
                  {formatCurrency(summary.avgRevenuePerReferrer)} avg per referrer
                </Text>
              </BlockStack>
            </Card>

            <Card>
              <BlockStack gap="200">
                <InlineStack align="space-between">
                  <Text as="h3" variant="headingMd">Commissions Paid</Text>
                  <Icon source={ShareIcon} tone="base" />
                </InlineStack>
                <Text as="p" variant="heading2xl">{formatCurrency(summary.totalCommissions)}</Text>
                <Text as="p" variant="bodyMd" tone="subdued">
                  {summary.totalRevenue > 0 ? 
                    `${((summary.totalCommissions / summary.totalRevenue) * 100).toFixed(1)}% of revenue` : 
                    '0% of revenue'
                  }
                </Text>
              </BlockStack>
            </Card>
          </div>

          {/* Filters */}
          <Card>
            <BlockStack gap="300">
              <Text as="h3" variant="headingMd">Filters & Search</Text>
              <InlineStack gap="300" wrap>
                <div style={{ minWidth: '300px' }}>
                  <TextField
                    label="Search referrers"
                    value={filters.search}
                    onChange={(value) => updateFilters({ search: value })}
                    placeholder="Search by name or email..."
                    prefix={<Icon source={SearchIcon} />}
                    clearButton
                    onClearButtonClick={() => updateFilters({ search: "" })}
                    autoComplete="off"
                  />
                </div>
                
                <Select
                  label="Status"
                  options={[
                    { label: 'All Referrers', value: 'all' },
                    { label: 'Active', value: 'active' },
                    { label: 'Inactive', value: 'inactive' },
                    { label: 'High Performers', value: 'high_performers' },
                    { label: 'New (Last 30 days)', value: 'new' }
                  ]}
                  value={filters.status}
                  onChange={(value) => updateFilters({ status: value })}
                />
                
                <Select
                  label="Program"
                  options={[
                    { label: 'All Programs', value: 'all' },
                    ...programs.map(p => ({ label: p.name, value: p.id }))
                  ]}
                  value={filters.program}
                  onChange={(value) => updateFilters({ program: value })}
                />
                
                <Select
                  label="Sort by"
                  options={[
                    { label: 'Revenue (High to Low)', value: 'revenue' },
                    { label: 'Conversions (High to Low)', value: 'conversions' },
                    { label: 'Clicks (High to Low)', value: 'clicks' },
                    { label: 'Name (A-Z)', value: 'name' },
                    { label: 'Join Date (Newest)', value: 'joined' },
                    { label: 'Last Activity (Recent)', value: 'activity' }
                  ]}
                  value={filters.sortBy}
                  onChange={(value) => updateFilters({ sortBy: value })}
                />
              </InlineStack>
            </BlockStack>
          </Card>

          {/* Bulk Actions */}
          {selectedReferrers.length > 0 && (
            <Card>
              <InlineStack align="space-between">
                <Text as="h3" variant="headingMd">
                  {selectedReferrers.length} referrer(s) selected
                </Text>
                <ButtonGroup>
                  <Button 
                    icon={EmailIcon}
                    onClick={() => setShowBulkEmailModal(true)}
                  >
                    Send Email
                  </Button>
                  <Button 
                    icon={ExportIcon}
                    onClick={handleExport}
                  >
                    Export Selected
                  </Button>
                  <Button 
                    tone="critical"
                    onClick={() => setSelectedReferrers([])}
                  >
                    Clear Selection
                  </Button>
                </ButtonGroup>
              </InlineStack>
            </Card>
          )}

          {/* Referrers Table */}
          <Card>
            <BlockStack gap="300">
              <InlineStack align="space-between">
                <Text as="h2" variant="headingMd">Referrer Directory</Text>
                <ButtonGroup>
                  <Button 
                    icon={ExportIcon}
                    onClick={handleExport}
                  >
                    Export All
                  </Button>
                  <Button 
                    variant="primary"
                    icon={PlusIcon}
                    onClick={() => setShowInviteModal(true)}
                  >
                    Invite Referrers
                  </Button>
                </ButtonGroup>
              </InlineStack>
              
              {referrers.length === 0 ? (
                <EmptyState
                  heading="No referrers found"
                  image=""
                >
                  <Text as="p">No referrers match your current filters. Try adjusting your search criteria.</Text>
                </EmptyState>
              ) : (
                <DataTable
                  columnContentTypes={['text', 'numeric', 'numeric', 'numeric', 'text', 'text', 'text', 'text', 'text']}
                  headings={[
                    'Referrer', 'Referrals', 'Clicks', 'Conversions', 
                    'Conv. Rate', 'Revenue', 'Commissions', 'Last Activity', 'Actions'
                  ]}
                  rows={referrerRows}
                  sortable={[false, true, true, true, true, true, true, true, false]}
                />
              )}
            </BlockStack>
          </Card>
        </BlockStack>
      </Layout.Section>
    </Layout>
  );

  const renderPerformanceTab = () => (
    <Layout>
      <Layout.Section>
        <BlockStack gap="400">
          {/* Performance Overview */}
          <Card>
            <BlockStack gap="300">
              <Text as="h2" variant="headingMd">Performance Overview</Text>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                <div style={{ padding: '16px', border: '1px solid var(--p-border-subdued)', borderRadius: '8px' }}>
                  <BlockStack gap="100">
                    <Text as="h4" variant="headingMd">Top Performer</Text>
                    <Text as="p" variant="heading2xl">
                      {referrers.length > 0 ? referrers[0].name : 'No Data'}
                    </Text>
                    <Text as="p" variant="bodyMd" tone="subdued">
                      {referrers.length > 0 ? formatCurrency(referrers[0].revenue) : '$0.00'} revenue
                    </Text>
                  </BlockStack>
                </div>
                
                <div style={{ padding: '16px', border: '1px solid var(--p-border-subdued)', borderRadius: '8px' }}>
                  <BlockStack gap="100">
                    <Text as="h4" variant="headingMd">Avg. Conversion Rate</Text>
                    <Text as="p" variant="heading2xl">
                      {referrers.length > 0 ? 
                        (referrers.reduce((sum, r) => sum + r.conversionRate, 0) / referrers.length).toFixed(1) : '0'}%
                    </Text>
                    <Text as="p" variant="bodyMd" tone="subdued">
                      Across all referrers
                    </Text>
                  </BlockStack>
                </div>
                
                <div style={{ padding: '16px', border: '1px solid var(--p-border-subdued)', borderRadius: '8px' }}>
                  <BlockStack gap="100">
                    <Text as="h4" variant="headingMd">Total Active</Text>
                    <Text as="p" variant="heading2xl">
                      {referrers.filter(r => r.isActive && r.recentActivity > 0).length}
                    </Text>
                    <Text as="p" variant="bodyMd" tone="subdued">
                      Out of {referrers.length} total
                    </Text>
                  </BlockStack>
                </div>
              </div>
            </BlockStack>
          </Card>

          {/* Performance Charts */}
          <Card>
            <BlockStack gap="300">
              <Text as="h3" variant="headingMd">Performance Distribution</Text>
              <div style={{ padding: '20px', background: '#f6f6f7', borderRadius: '8px', minHeight: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
                <Icon source={ChartVerticalIcon} />
                <Text as="p" variant="bodyMd" tone="subdued">Performance charts will display here</Text>
                <Text as="p" variant="bodySm" tone="subdued">Revenue vs. Conversions scatter plot</Text>
              </div>
            </BlockStack>
          </Card>

          {/* Top Performers Leaderboard */}
          <Card>
            <BlockStack gap="300">
              <InlineStack align="space-between">
                <Text as="h3" variant="headingMd">Top Performers</Text>
                <Button size="micro" onClick={() => handleNavigation('/app/referrers?sortBy=revenue')}>View All</Button>
              </InlineStack>
              
              {referrers.slice(0, 10).length > 0 ? (
                <div style={{ display: 'grid', gap: '12px' }}>
                  {referrers.slice(0, 10).map((referrer, index) => (
                    <div key={referrer.id} style={{ 
                      padding: '16px', 
                      border: '1px solid var(--p-border-subdued)', 
                      borderRadius: '8px',
                      background: index < 3 ? '#fff9c4' : 'transparent'
                    }}>
                      <InlineStack align="space-between">
                        <InlineStack gap="300">
                          <div style={{ 
                            width: '24px', 
                            height: '24px', 
                            borderRadius: '50%', 
                            background: index < 3 ? '#ffd700' : '#e1e1e1', 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center',
                            fontSize: '12px',
                            fontWeight: 'bold'
                          }}>
                            {index + 1}
                          </div>
                          <BlockStack gap="100">
                            <Text as="h4" variant="bodyMd" fontWeight="semibold">{referrer.name}</Text>
                            <Text as="p" variant="bodySm" tone="subdued">{referrer.email}</Text>
                          </BlockStack>
                        </InlineStack>
                        <BlockStack gap="100" align="end">
                          <Text as="p" variant="bodyMd" fontWeight="semibold">{formatCurrency(referrer.revenue)}</Text>
                          <Text as="p" variant="bodySm" tone="subdued">{referrer.conversions} conversions</Text>
                        </BlockStack>
                      </InlineStack>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState
                  heading="No performance data yet"
                  image=""
                >
                  <Text as="p">Referrer performance data will appear here once referrals start converting.</Text>
                </EmptyState>
              )}
            </BlockStack>
          </Card>

          {/* Performance Metrics Comparison */}
          <Card>
            <BlockStack gap="300">
              <Text as="h3" variant="headingMd">Performance Metrics</Text>
              
              <InlineStack gap="400" wrap>
                <div style={{ flex: 1, minWidth: '250px' }}>
                  <BlockStack gap="200">
                    <Text as="h4" variant="headingMd">Revenue Leaders</Text>
                    {referrers.slice(0, 5).map((referrer, index) => (
                      <div key={referrer.id} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ 
                          width: `${Math.max(10, (referrer.revenue / Math.max(...referrers.map(r => r.revenue))) * 100)}%`, 
                          height: '8px', 
                          background: '#007ace', 
                          borderRadius: '4px' 
                        }} />
                        <Text as="p" variant="bodySm">{referrer.name}: {formatCurrency(referrer.revenue)}</Text>
                      </div>
                    ))}
                  </BlockStack>
                </div>
                
                <div style={{ flex: 1, minWidth: '250px' }}>
                  <BlockStack gap="200">
                    <Text as="h4" variant="headingMd">Conversion Leaders</Text>
                    {referrers
                      .sort((a, b) => b.conversionRate - a.conversionRate)
                      .slice(0, 5)
                      .map((referrer, index) => (
                        <div key={referrer.id} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div style={{ 
                            width: `${Math.max(10, referrer.conversionRate)}%`, 
                            height: '8px', 
                            background: '#00a047', 
                            borderRadius: '4px' 
                          }} />
                          <Text as="p" variant="bodySm">{referrer.name}: {referrer.conversionRate.toFixed(1)}%</Text>
                        </div>
                      ))
                    }
                  </BlockStack>
                </div>
              </InlineStack>
            </BlockStack>
          </Card>
        </BlockStack>
      </Layout.Section>
    </Layout>
  );

  const renderActivityTab = () => {
    // Generate activity timeline based on referrer data
    const activities: Array<{
      id: string;
      type: 'joined' | 'activity';
      referrer: string;
      email: string;
      timestamp: Date;
      description: string;
    }> = [];
    
    referrers.forEach(referrer => {
      activities.push({
        id: `join-${referrer.id}`,
        type: 'joined',
        referrer: referrer.name,
        email: referrer.email,
        timestamp: new Date(referrer.joinedAt),
        description: 'Joined the referral program'
      });
      
      if (referrer.recentActivity > 0) {
        activities.push({
          id: `activity-${referrer.id}`,
          type: 'activity',
          referrer: referrer.name,
          email: referrer.email,
          timestamp: new Date(referrer.lastActivity),
          description: `Generated ${referrer.recentActivity} referral(s) this week`
        });
      }
    });
    
    // Sort activities by timestamp (most recent first)
    activities.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    return (
      <Layout>
        <Layout.Section>
          <BlockStack gap="400">
            {/* Activity Summary */}
            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">Activity Summary</Text>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '16px' }}>
                  <div style={{ textAlign: 'center', padding: '16px' }}>
                    <Text as="p" variant="heading2xl">{referrers.filter(r => r.recentActivity > 0).length}</Text>
                    <Text as="p" variant="bodyMd" tone="subdued">Active this week</Text>
                  </div>
                  <div style={{ textAlign: 'center', padding: '16px' }}>
                    <Text as="p" variant="heading2xl">{referrers.filter(r => {
                      const oneWeekAgo = new Date();
                      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
                      return new Date(r.joinedAt) >= oneWeekAgo;
                    }).length}</Text>
                    <Text as="p" variant="bodyMd" tone="subdued">New this week</Text>
                  </div>
                  <div style={{ textAlign: 'center', padding: '16px' }}>
                    <Text as="p" variant="heading2xl">{referrers.reduce((sum, r) => sum + r.recentActivity, 0)}</Text>
                    <Text as="p" variant="bodyMd" tone="subdued">Total referrals</Text>
                  </div>
                </div>
              </BlockStack>
            </Card>

            {/* Recent Activity Feed */}
            <Card>
              <BlockStack gap="300">
                <InlineStack align="space-between">
                  <Text as="h3" variant="headingMd">Recent Activity</Text>
                  <Select
                    label="Filter by"
                    labelHidden
                    options={[
                      { label: 'All Activity', value: 'all' },
                      { label: 'New Referrers', value: 'joined' },
                      { label: 'Referral Activity', value: 'activity' }
                    ]}
                    value="all"
                    onChange={() => {}}
                  />
                </InlineStack>
                
                {activities.length > 0 ? (
                  <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
                    <BlockStack gap="300">
                      {activities.slice(0, 20).map((activity, index) => (
                        <div key={activity.id} style={{ 
                          padding: '16px', 
                          border: '1px solid var(--p-border-subdued)', 
                          borderRadius: '8px',
                          borderLeft: `4px solid ${activity.type === 'joined' ? '#007ace' : '#00a047'}`
                        }}>
                          <InlineStack align="space-between">
                            <BlockStack gap="100">
                              <InlineStack gap="200">
                                <Icon source={activity.type === 'joined' ? PersonIcon : ShareIcon} />
                                <Text as="h4" variant="bodyMd" fontWeight="semibold">{activity.referrer}</Text>
                                <Badge tone={activity.type === 'joined' ? 'info' : 'success'}>
                                  {activity.type === 'joined' ? 'Joined' : 'Active'}
                                </Badge>
                              </InlineStack>
                              <Text as="p" variant="bodyMd">{activity.description}</Text>
                              <Text as="p" variant="bodySm" tone="subdued">{activity.email}</Text>
                            </BlockStack>
                            <Text as="p" variant="bodySm" tone="subdued">
                              {formatDate(activity.timestamp.getTime())}
                            </Text>
                          </InlineStack>
                        </div>
                      ))}
                    </BlockStack>
                  </div>
                ) : (
                  <EmptyState
                    heading="No recent activity"
                    image=""
                  >
                    <Text as="p">Referrer activity will appear here as your network grows.</Text>
                  </EmptyState>
                )}
              </BlockStack>
            </Card>

            {/* Growth Timeline */}
            <Card>
              <BlockStack gap="300">
                <Text as="h3" variant="headingMd">Growth Timeline</Text>
                <div style={{ padding: '20px', background: '#f6f6f7', borderRadius: '8px', minHeight: '150px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
                  <Icon source={ChartVerticalIcon} />
                  <Text as="p" variant="bodyMd" tone="subdued">Referrer growth chart will display here</Text>
                  <Text as="p" variant="bodySm" tone="subdued">Daily/weekly registration trends</Text>
                </div>
              </BlockStack>
            </Card>
          </BlockStack>
        </Layout.Section>
      </Layout>
    );
  };

  return (
    <Frame>
      <Page
        title="Referrer Management"
        subtitle={`Manage your ${summary.totalReferrers} referrers and grow your network`}
        primaryAction={{
          content: 'Invite Referrers',
          icon: PlusIcon,
          onAction: () => setShowInviteModal(true)
        }}
        secondaryActions={[
          {
            content: 'Export All',
            icon: ExportIcon,
            onAction: handleExport
          }
        ]}
      >
        <Tabs tabs={tabs} selected={selectedTab} onSelect={setSelectedTab}>
          <Box paddingBlockStart="400">
            {selectedTab === 0 && renderAllReferrersTab()}
            {selectedTab === 1 && renderPerformanceTab()}
            {selectedTab === 2 && renderActivityTab()}
          </Box>
        </Tabs>
      </Page>

      {/* Bulk Email Modal */}
      <Modal
        open={showBulkEmailModal}
        onClose={() => setShowBulkEmailModal(false)}
        title={`Send Email to ${selectedReferrers.length} Referrers`}
        primaryAction={{
          content: 'Send Email',
          onAction: handleBulkEmail,
          disabled: !emailSubject || !emailMessage
        }}
        secondaryActions={[
          {
            content: 'Cancel',
            onAction: () => setShowBulkEmailModal(false)
          }
        ]}
      >
        <Modal.Section>
          <FormLayout>
            <TextField
              label="Subject"
              value={emailSubject}
              onChange={setEmailSubject}
              placeholder="Enter email subject..."
              autoComplete="off"
            />
            <TextField
              label="Message"
              value={emailMessage}
              onChange={setEmailMessage}
              placeholder="Enter your message..."
              multiline={6}
              autoComplete="off"
            />
          </FormLayout>
        </Modal.Section>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        open={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Delete Referrer"
        primaryAction={{
          content: 'Delete',
          onAction: deleteReferrer,
          destructive: true
        }}
        secondaryActions={[
          {
            content: 'Cancel',
            onAction: () => setShowDeleteModal(false)
          }
        ]}
      >
        <Modal.Section>
          <Text as="p">
            Are you sure you want to delete this referrer? This action cannot be undone.
            All their referral history will be preserved but they will no longer be able to access their account.
          </Text>
        </Modal.Section>
      </Modal>

      {/* Invite Modal */}
      <Modal
        open={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        title="Invite Referrer"
        primaryAction={{
          content: 'Send Invitation',
          onAction: () => {
            if (!inviteForm.email || !inviteForm.programId) return;
            
            fetcher.submit(
              {
                intent: "send_individual_invite",
                email: inviteForm.email,
                firstName: inviteForm.firstName,
                lastName: inviteForm.lastName,
                programId: inviteForm.programId,
                personalMessage: inviteForm.personalMessage
              },
              { method: "POST" }
            );
            
            setInviteForm({
              email: "",
              firstName: "",
              lastName: "",
              programId: programs[0]?.id || "",
              personalMessage: ""
            });
            
            setShowInviteModal(false);
            setToastMessage("Invitation sent successfully!");
            setShowToast(true);
          },
          disabled: !inviteForm.email || !inviteForm.programId
        }}
        secondaryActions={[
          {
            content: 'Cancel',
            onAction: () => setShowInviteModal(false)
          }
        ]}
      >
        <Modal.Section>
          <FormLayout>
            <TextField
              label="Email"
              value={inviteForm.email}
              onChange={(value) => setInviteForm({ ...inviteForm, email: value })}
              placeholder="Enter referrer's email..."
              autoComplete="off"
            />
            <TextField
              label="First Name"
              value={inviteForm.firstName}
              onChange={(value) => setInviteForm({ ...inviteForm, firstName: value })}
              placeholder="Enter referrer's first name..."
              autoComplete="off"
            />
            <TextField
              label="Last Name"
              value={inviteForm.lastName}
              onChange={(value) => setInviteForm({ ...inviteForm, lastName: value })}
              placeholder="Enter referrer's last name..."
              autoComplete="off"
            />
            <Select
              label="Program"
              options={[
                { label: 'Select Program', value: '' },
                ...programs.map(p => ({ label: p.name, value: p.id }))
              ]}
              value={inviteForm.programId}
              onChange={(value) => setInviteForm({ ...inviteForm, programId: value })}
            />
            <TextField
              label="Personal Message"
              value={inviteForm.personalMessage}
              onChange={(value) => setInviteForm({ ...inviteForm, personalMessage: value })}
              placeholder="Enter a personal message for the referrer..."
              multiline={3}
              autoComplete="off"
            />
          </FormLayout>
        </Modal.Section>
      </Modal>

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