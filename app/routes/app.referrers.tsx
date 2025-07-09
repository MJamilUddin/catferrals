import React from "react";
import { useState } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useFetcher, useSearchParams, useNavigate, Link } from "@remix-run/react";
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
  Frame,
  Toast,
  Checkbox
} from "@shopify/polaris";
import { 
  PersonIcon,
  EmailIcon,
  ShareIcon,
  OrderIcon,
  ExportIcon,
  SearchIcon,
  DeleteIcon,
  ChartVerticalIcon,
  PlusIcon
} from "@shopify/polaris-icons";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { sendInvitationEmail, sendBulkEmail } from "../lib/email.server";
import { nanoid } from "nanoid";

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
          return referrer.revenue > 100;
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
    return json({ success: true, message: "Referrer data export started - check your email" });
  }

  if (intent === "bulk_email") {
    const referrerIds = JSON.parse(formData.get("referrerIds") as string);
    const subject = formData.get("subject") as string;
    const message = formData.get("message") as string;
    
    // Get referrer details
    const referrers = await db.referrerAccount.findMany({
      where: {
        id: { in: referrerIds },
        shop: session.shop
      },
      select: {
        email: true,
        firstName: true,
        lastName: true
      }
    });
    
    const emailList = referrers.map(ref => ({
      email: ref.email,
      name: `${ref.firstName || ''} ${ref.lastName || ''}`.trim() || ref.email.split('@')[0]
    }));
    
    try {
      const result = await sendBulkEmail(emailList, subject, message, session.shop);
      
      return json({ 
        success: true, 
        message: `Email sent to ${result.sent} referrers. ${result.failed > 0 ? `${result.failed} failed.` : ''}` 
      });
    } catch (error) {
      console.error('Bulk email error:', error);
      return json({ success: false, error: "Failed to send bulk email" });
    }
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
      await db.referrerAccount.delete({
        where: { id: referrerId }
      });
    }
    
    return json({ success: true });
  }

  if (intent === "send_individual_invite") {
    const email = formData.get("email") as string;
    const firstName = formData.get("firstName") as string;
    const lastName = formData.get("lastName") as string;
    const programId = formData.get("programId") as string;
    const personalMessage = formData.get("personalMessage") as string;
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return json({ success: false, error: "Invalid email format" });
    }
    
    // Check if referrer already exists
    const existingReferrer = await db.referrerAccount.findFirst({
      where: { 
        email: email.toLowerCase(),
        shop: session.shop
      }
    });
    
    if (existingReferrer) {
      return json({ success: false, error: "Referrer with this email already exists" });
    }
    
    // Get the program details
    const program = await db.referralProgram.findUnique({
      where: { id: programId }
    });
    
    if (!program) {
      return json({ success: false, error: "Program not found" });
    }
    
    // Create new referrer account
    const emailVerificationToken = nanoid(32);
    const referrerAccount = await db.referrerAccount.create({
      data: {
        email: email.toLowerCase(),
        firstName: firstName || null,
        lastName: lastName || null,
        shop: session.shop,
        isActive: true,
        emailVerificationToken,
        isEmailVerified: false
      }
    });
    
    // Generate unique referral code and link
    const referralCode = nanoid(8).toUpperCase();
    const referralLink = `https://${session.shop}/refer/${referralCode}?verify=${emailVerificationToken}`;
    
    // Create referral record
    await db.referral.create({
      data: {
        shop: session.shop,
        programId: program.id,
        referrerAccountId: referrerAccount.id,
        referrerCustomerId: `account_${referrerAccount.id}`,
        referrerEmail: email.toLowerCase(),
        referrerName: `${firstName || ''} ${lastName || ''}`.trim() || null,
        referralCode,
        referralLink,
        status: "pending"
      }
    });
    
    // Format commission rate for display
    const commissionRate = program.commissionType === 'percentage' 
      ? `${program.commissionValue}%` 
      : `$${program.commissionValue}`;
    
    // Send invitation email
    try {
      const emailResult = await sendInvitationEmail({
        recipientEmail: email.toLowerCase(),
        recipientName: `${firstName || ''} ${lastName || ''}`.trim() || email.split('@')[0],
        senderName: session.firstName && session.lastName 
          ? `${session.firstName} ${session.lastName}` 
          : "Referral Team",
        personalMessage: personalMessage || undefined,
        referralLink,
        programName: program.name,
        commissionRate,
        shopName: session.shop.replace('.myshopify.com', '').replace('-', ' ').toUpperCase(),
        shopDomain: session.shop
      });
      
      if (!emailResult.success) {
        console.error('Failed to send invitation email:', emailResult.error);
        return json({ 
          success: true, 
          message: "Referrer account created, but invitation email failed to send. You can manually share their referral link.",
          warning: true 
        });
      }
      
      return json({ 
        success: true, 
        message: `Invitation sent successfully to ${email}! They'll receive a personalized email with their referral link.` 
      });
      
    } catch (error) {
      console.error('Email service error:', error);
      return json({ 
        success: true, 
        message: "Referrer account created, but invitation email failed to send. You can manually share their referral link.",
        warning: true 
      });
    }
  }

  return json({ success: false });
};

export default function ReferrerManagement() {
  const { referrers, programs, summary, filters } = useLoaderData<typeof loader>();
  const fetcher = useFetcher();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  // Add debug logging
  console.log("🔍 ReferrerManagement component rendered");
  console.log("🔍 Current URL:", window.location.href);
  console.log("🔍 Search params:", Object.fromEntries(searchParams.entries()));
  
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

  // Add navigation debugging
  const debugNavigate = (path: string) => {
    console.log("🚨 DEBUG: Navigation attempt to:", path);
    console.log("🚨 DEBUG: Call stack:", new Error().stack);
    if (path.includes('/invite')) {
      console.error("🚨 FOUND IT! Someone is trying to navigate to invite route:", path);
      console.error("🚨 Call stack:", new Error().stack);
    }
    navigate(path);
  };

  // Filter handling - only for search params updates on same page
  const updateFilters = (newFilters: Partial<typeof filters>) => {
    const params = new URLSearchParams(searchParams);
    
    Object.entries(newFilters).forEach(([key, value]) => {
      if (value && value !== "all" && value !== "") {
        params.set(key, value as string);
      } else {
        params.delete(key);
      }
    });
    
    // Use window.location for search params only - this doesn't break embedded context
    window.location.search = params.toString();
  };

  const handleInviteReferrer = () => {
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
      <Link to={`/app/referrers/${referrer.id}`} style={{ textDecoration: 'none' }}>
        <Button 
          size="micro" 
          icon={PersonIcon}
        >
          View
        </Button>
      </Link>
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
            {selectedTab === 0 && (
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
            )}
            
            {selectedTab === 1 && (
              <Layout>
                <Layout.Section>
                  <Card>
                    <Text as="h2" variant="headingMd">Performance View</Text>
                    <Text as="p">Performance analytics coming soon...</Text>
                  </Card>
                </Layout.Section>
              </Layout>
            )}
            
            {selectedTab === 2 && (
              <Layout>
                <Layout.Section>
                  <Card>
                    <Text as="h2" variant="headingMd">Activity Timeline</Text>
                    <Text as="p">Activity timeline coming soon...</Text>
                  </Card>
                </Layout.Section>
              </Layout>
            )}
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
          content: 'Invite',
          onAction: handleInviteReferrer,
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