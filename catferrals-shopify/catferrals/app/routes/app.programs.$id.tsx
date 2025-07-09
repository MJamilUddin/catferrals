import { useEffect, useState } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useFetcher, useNavigate } from "@remix-run/react";
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
  Divider,
  Icon,
  Banner,
  Modal,
  FormLayout,
  TextField,
  Select,
  Checkbox,
  Tabs,
  Thumbnail,
  ProgressBar,
  Tooltip,
  List,
  EmptyState,
  ActionList,
  Popover,
  ButtonGroup,
  Frame,
  Toast,
} from "@shopify/polaris";
import { 
  PlusIcon, 
  ShareIcon, 
  ChartVerticalIcon,
  PersonIcon,
  OrderIcon,
  EditIcon,
  DeleteIcon,
  ExportIcon,
  EmailIcon,
  SettingsIcon,
  ViewIcon,
  DuplicateIcon,
  CheckIcon,
  AlertTriangleIcon,
  CalendarIcon,
  FilterIcon,
  SearchIcon,
  RefreshIcon
} from "@shopify/polaris-icons";
import { TitleBar, useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const programId = params.id;

  if (!programId) {
    throw new Error("Program ID is required");
  }

  // Get program with all related data
  const program = await db.referralProgram.findFirst({
    where: { id: programId, shop: session.shop },
    include: {
      referrals: {
        include: {
          clicks: true,
          referrerAccount: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              createdAt: true,
              totalReferrals: true,
              totalConversions: true,
              totalCommissionEarned: true
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      }
    }
  });

  if (!program) {
    throw new Error("Program not found");
  }

  // Calculate program metrics
  const totalReferrals = program.referrals.length;
  const totalClicks = program.referrals.reduce((sum, ref) => sum + ref.clickCount, 0);
  const convertedReferrals = program.referrals.filter(r => r.status === 'converted').length;
  const totalCommissions = program.referrals.reduce((sum, ref) => sum + (ref.commissionAmount || 0), 0);
  const conversionRate = totalClicks > 0 ? ((convertedReferrals / totalClicks) * 100) : 0;

  // Get unique referrers
  const referrerAccounts = program.referrals.reduce((acc, ref) => {
    if (ref.referrerAccount && !acc.find(r => r.id === ref.referrerAccount.id)) {
      acc.push(ref.referrerAccount);
    }
    return acc;
  }, [] as any[]);

  // Calculate recent activity (last 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  const recentReferrals = program.referrals.filter(r => r.createdAt >= thirtyDaysAgo);
  const recentConversions = program.referrals.filter(r => r.convertedAt && r.convertedAt >= thirtyDaysAgo);

  const metrics = {
    totalReferrals,
    totalClicks,
    convertedReferrals,
    conversionRate: conversionRate.toFixed(1),
    totalCommissions: totalCommissions.toFixed(2),
    totalReferrers: referrerAccounts.length,
    recentActivity: {
      referrals: recentReferrals.length,
      conversions: recentConversions.length,
      clicks: recentReferrals.reduce((sum, ref) => sum + ref.clickCount, 0)
    }
  };

  return json({ program, metrics, referrerAccounts });
};

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const programId = params.id;
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "update_program") {
    await db.referralProgram.update({
      where: { id: programId },
      data: {
        name: formData.get("name") as string,
        description: formData.get("description") as string,
        commissionType: formData.get("commissionType") as string,
        commissionValue: parseFloat(formData.get("commissionValue") as string),
        minimumOrderValue: formData.get("minimumOrderValue") 
          ? parseFloat(formData.get("minimumOrderValue") as string) 
          : null,
        maximumCommission: formData.get("maximumCommission")
          ? parseFloat(formData.get("maximumCommission") as string)
          : null,
        allowSelfRegistration: formData.get("allowSelfRegistration") === "true",
        welcomeMessage: formData.get("welcomeMessage") as string,
        isActive: formData.get("isActive") === "true"
      }
    });
    return json({ success: true });
  }

  if (intent === "delete_program") {
    await db.referralProgram.delete({
      where: { id: programId }
    });
    return json({ success: true, deleted: true });
  }

  return json({ success: false });
};

export default function ProgramManagement() {
  const { program, metrics, referrerAccounts } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const navigate = useNavigate();
  const shopify = useAppBridge();
  
  const [selectedTab, setSelectedTab] = useState(0);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showActionsPopover, setShowActionsPopover] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  
  const [formData, setFormData] = useState({
    name: program.name,
    description: program.description || '',
    commissionType: program.commissionType,
    commissionValue: program.commissionValue.toString(),
    minimumOrderValue: program.minimumOrderValue?.toString() || '',
    maximumCommission: program.maximumCommission?.toString() || '',
    allowSelfRegistration: program.allowSelfRegistration,
    welcomeMessage: program.welcomeMessage || '',
    isActive: program.isActive
  });

  const isLoading = fetcher.state === "submitting";

  useEffect(() => {
    if (fetcher.data?.success) {
      if ('deleted' in fetcher.data && fetcher.data.deleted) {
        navigate("/app");
        shopify.toast.show("Program deleted successfully");
      } else {
        setShowEditModal(false);
        setToastMessage("Program updated successfully");
        setShowToast(true);
      }
    }
  }, [fetcher.data, navigate, shopify]);

  const handleUpdate = () => {
    fetcher.submit(
      {
        intent: "update_program",
        ...formData,
        allowSelfRegistration: formData.allowSelfRegistration.toString(),
        isActive: formData.isActive.toString()
      },
      { method: "POST" }
    );
  };

  const handleDelete = () => {
    fetcher.submit(
      { intent: "delete_program" },
      { method: "POST" }
    );
  };

  const copyRegistrationLink = () => {
    const link = `https://${program.shop}/apps/catferrals/register?program=${program.id}`;
    navigator.clipboard.writeText(link);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  // Prepare data for referrals table - using strings only
  const referralRows = program.referrals.map(referral => [
    referral.referralCode,
    referral.referrerAccount ? 
      `${referral.referrerAccount.firstName || ''} ${referral.referrerAccount.lastName || ''}`.trim() || referral.referrerAccount.email :
      referral.referrerEmail,
    referral.status.charAt(0).toUpperCase() + referral.status.slice(1),
    referral.clickCount.toString(),
    referral.status === 'converted' ? `$${referral.orderValue?.toFixed(2) || '0.00'}` : '-',
    referral.status === 'converted' ? `$${referral.commissionAmount?.toFixed(2) || '0.00'}` : '-',
    new Date(referral.createdAt).toLocaleDateString(),
    'Actions'
  ]);

  const copyReferralLink = (link: string) => {
    navigator.clipboard.writeText(link);
    setToastMessage("Referral link copied to clipboard");
    setShowToast(true);
  };

  const tabs = [
    { id: 'overview', content: 'Overview', badge: metrics.totalReferrals.toString() },
    { id: 'referrals', content: 'Referrals', badge: metrics.totalReferrals.toString() },
    { id: 'referrers', content: 'Referrers', badge: metrics.totalReferrers.toString() },
    { id: 'analytics', content: 'Analytics' },
    { id: 'settings', content: 'Settings' }
  ];

  const actionItems = [
    { content: 'Edit Program', icon: EditIcon, onAction: () => setShowEditModal(true) },
    { content: 'Copy Registration Link', icon: DuplicateIcon, onAction: copyRegistrationLink },
    { content: 'Export Data', icon: ExportIcon, onAction: () => console.log('Export') },
    { content: 'Delete Program', icon: DeleteIcon, destructive: true, onAction: () => setShowDeleteModal(true) },
  ];

  const renderOverviewTab = () => (
    <Layout>
      <Layout.Section>
        <BlockStack gap="400">
          {/* Program Status Banner */}
          {!program.isActive && (
            <Banner tone="warning">
              <Text as="p">This program is currently inactive. New referrals cannot be created.</Text>
            </Banner>
          )}

          {/* Key Metrics */}
          <Card>
            <BlockStack gap="300">
              <Text as="h2" variant="headingMd">Performance Overview</Text>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                <Box padding="300" background="bg-surface-secondary" borderRadius="200">
                  <BlockStack gap="100">
                    <InlineStack align="space-between">
                      <Text as="p" variant="bodyMd" tone="subdued">Total Referrals</Text>
                      <Icon source={ShareIcon} tone="base" />
                    </InlineStack>
                    <Text as="p" variant="heading2xl">{metrics.totalReferrals}</Text>
                    <Text as="p" variant="bodyMd" tone="success">+{metrics.recentActivity.referrals} this month</Text>
                  </BlockStack>
                </Box>
                
                <Box padding="300" background="bg-surface-secondary" borderRadius="200">
                  <BlockStack gap="100">
                    <InlineStack align="space-between">
                      <Text as="p" variant="bodyMd" tone="subdued">Total Clicks</Text>
                      <Icon source={ChartVerticalIcon} tone="base" />
                    </InlineStack>
                    <Text as="p" variant="heading2xl">{metrics.totalClicks}</Text>
                    <Text as="p" variant="bodyMd" tone="success">+{metrics.recentActivity.clicks} this month</Text>
                  </BlockStack>
                </Box>
                
                <Box padding="300" background="bg-surface-secondary" borderRadius="200">
                  <BlockStack gap="100">
                    <InlineStack align="space-between">
                      <Text as="p" variant="bodyMd" tone="subdued">Conversions</Text>
                      <Icon source={OrderIcon} tone="base" />
                    </InlineStack>
                    <Text as="p" variant="heading2xl">{metrics.convertedReferrals}</Text>
                    <Text as="p" variant="bodyMd" tone="success">+{metrics.recentActivity.conversions} this month</Text>
                  </BlockStack>
                </Box>
                
                <Box padding="300" background="bg-surface-secondary" borderRadius="200">
                  <BlockStack gap="100">
                    <InlineStack align="space-between">
                      <Text as="p" variant="bodyMd" tone="subdued">Conversion Rate</Text>
                      <Icon source={ChartVerticalIcon} tone="base" />
                    </InlineStack>
                    <Text as="p" variant="heading2xl">{metrics.conversionRate}%</Text>
                    <Text as="p" variant="bodyMd" tone="subdued">Click to conversion</Text>
                  </BlockStack>
                </Box>
                
                <Box padding="300" background="bg-surface-secondary" borderRadius="200">
                  <BlockStack gap="100">
                    <InlineStack align="space-between">
                      <Text as="p" variant="bodyMd" tone="subdued">Total Revenue</Text>
                      <Icon source={ChartVerticalIcon} tone="base" />
                    </InlineStack>
                    <Text as="p" variant="heading2xl">${metrics.totalCommissions}</Text>
                    <Text as="p" variant="bodyMd" tone="subdued">Commission earned</Text>
                  </BlockStack>
                </Box>
                
                <Box padding="300" background="bg-surface-secondary" borderRadius="200">
                  <BlockStack gap="100">
                    <InlineStack align="space-between">
                      <Text as="p" variant="bodyMd" tone="subdued">Active Referrers</Text>
                      <Icon source={PersonIcon} tone="base" />
                    </InlineStack>
                    <Text as="p" variant="heading2xl">{metrics.totalReferrers}</Text>
                    <Text as="p" variant="bodyMd" tone="subdued">Registered referrers</Text>
                  </BlockStack>
                </Box>
              </div>
            </BlockStack>
          </Card>

          {/* Program Details */}
          <Card>
            <BlockStack gap="300">
              <Text as="h2" variant="headingMd">Program Details</Text>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
                <Box>
                  <BlockStack gap="200">
                    <Text as="p" variant="bodyMd" tone="subdued">Commission Structure</Text>
                    <Text as="p" variant="bodyMd">
                      {program.commissionType === 'percentage' ? `${program.commissionValue}%` : `$${program.commissionValue}`} per referral
                    </Text>
                  </BlockStack>
                </Box>
                <Box>
                  <BlockStack gap="200">
                    <Text as="p" variant="bodyMd" tone="subdued">Minimum Order</Text>
                    <Text as="p" variant="bodyMd">
                      {program.minimumOrderValue ? `$${program.minimumOrderValue}` : 'No minimum'}
                    </Text>
                  </BlockStack>
                </Box>
                <Box>
                  <BlockStack gap="200">
                    <Text as="p" variant="bodyMd" tone="subdued">Self Registration</Text>
                    <Badge tone={program.allowSelfRegistration ? 'success' : 'critical'}>
                      {program.allowSelfRegistration ? 'Enabled' : 'Disabled'}
                    </Badge>
                  </BlockStack>
                </Box>
                <Box>
                  <BlockStack gap="200">
                    <Text as="p" variant="bodyMd" tone="subdued">Created</Text>
                    <Text as="p" variant="bodyMd">
                      {new Date(program.createdAt).toLocaleDateString()}
                    </Text>
                  </BlockStack>
                </Box>
              </div>
            </BlockStack>
          </Card>

          {/* Registration Link */}
          <Card>
            <BlockStack gap="300">
              <Text as="h2" variant="headingMd">Registration Link</Text>
              <Text as="p" variant="bodyMd" tone="subdued">
                Share this link with potential referrers to join your program
              </Text>
              <InlineStack gap="200">
                <div style={{ flex: 1 }}>
                  <TextField
                    label=""
                    value={`https://${program.shop}/apps/catferrals/register?program=${program.id}`}
                    readOnly
                    autoComplete="off"
                  />
                </div>
                <Button 
                  onClick={copyRegistrationLink}
                  icon={copiedLink ? CheckIcon : DuplicateIcon}
                  tone={copiedLink ? 'success' : undefined}
                >
                  {copiedLink ? 'Copied!' : 'Copy'}
                </Button>
              </InlineStack>
            </BlockStack>
          </Card>
        </BlockStack>
      </Layout.Section>
    </Layout>
  );

  const renderReferralsTab = () => (
    <Layout>
      <Layout.Section>
        <Card>
          <BlockStack gap="300">
            <InlineStack align="space-between">
              <Text as="h2" variant="headingMd">All Referrals</Text>
              <Button variant="primary" icon={PlusIcon} url="/app/referrals/new">
                Create Referral
              </Button>
            </InlineStack>
            
            {program.referrals.length === 0 ? (
              <EmptyState
                heading="No referrals yet"
                action={{ content: 'Create first referral', url: '/app/referrals/new' }}
                image=""
              >
                <Text as="p">Start by creating your first referral or share the registration link with potential referrers.</Text>
              </EmptyState>
            ) : (
              <DataTable
                columnContentTypes={['text', 'text', 'text', 'numeric', 'text', 'text', 'text', 'text']}
                headings={['Code', 'Referrer', 'Status', 'Clicks', 'Order Value', 'Commission', 'Created', 'Actions']}
                rows={referralRows}
                pagination={{
                  hasNext: false,
                  hasPrevious: false,
                  onNext: () => {},
                  onPrevious: () => {},
                }}
              />
            )}
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
              <Text as="h2" variant="headingMd">Referrers</Text>
              <Button variant="primary" icon={PlusIcon} url="/app/referrers">
                Invite Referrer
              </Button>
            </InlineStack>
            
            {referrerAccounts.length === 0 ? (
              <EmptyState
                heading="No referrers yet"
                action={{ content: 'Invite first referrer', url: '/app/referrers' }}
                image=""
              >
                <Text as="p">Invite referrers to join your program and start earning commissions.</Text>
              </EmptyState>
            ) : (
              <DataTable
                columnContentTypes={['text', 'text', 'numeric', 'numeric', 'text', 'text']}
                headings={['Name', 'Email', 'Referrals', 'Conversions', 'Earned', 'Joined']}
                rows={referrerAccounts.map(referrer => [
                  `${referrer.firstName || ''} ${referrer.lastName || ''}`.trim() || '-',
                  referrer.email,
                  referrer.totalReferrals.toString(),
                  referrer.totalConversions.toString(),
                  `$${referrer.totalCommissionEarned.toFixed(2)}`,
                  new Date(referrer.createdAt).toLocaleDateString()
                ])}
              />
            )}
          </BlockStack>
        </Card>
      </Layout.Section>
    </Layout>
  );

  const renderAnalyticsTab = () => (
    <Layout>
      <Layout.Section>
        <BlockStack gap="400">
          <Card>
            <BlockStack gap="300">
              <Text as="h2" variant="headingMd">Performance Analytics</Text>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
                <Box padding="300" background="bg-surface-secondary" borderRadius="200">
                  <BlockStack gap="200">
                    <Text as="p" variant="bodyMd" tone="subdued">Conversion Funnel</Text>
                    <Text as="p" variant="bodyMd">Clicks → Conversions</Text>
                    <ProgressBar progress={parseFloat(metrics.conversionRate)} />
                    <Text as="p" variant="bodyMd">{metrics.totalClicks} clicks → {metrics.convertedReferrals} conversions</Text>
                  </BlockStack>
                </Box>
                <Box padding="300" background="bg-surface-secondary" borderRadius="200">
                  <BlockStack gap="200">
                    <Text as="p" variant="bodyMd" tone="subdued">Average Order Value</Text>
                    <Text as="p" variant="heading2xl">
                      ${metrics.convertedReferrals > 0 ? 
                        ((program.referrals.reduce((sum, ref) => sum + (ref.orderValue || 0), 0)) / metrics.convertedReferrals).toFixed(2) : 
                        '0.00'
                      }
                    </Text>
                    <Text as="p" variant="bodyMd" tone="subdued">Per converted referral</Text>
                  </BlockStack>
                </Box>
              </div>
            </BlockStack>
          </Card>
          
          <Card>
            <BlockStack gap="300">
              <Text as="h2" variant="headingMd">Recent Activity</Text>
              <Text as="p" variant="bodyMd" tone="subdued">Last 30 days</Text>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                <Box padding="300" background="bg-surface-secondary" borderRadius="200">
                  <BlockStack gap="100">
                    <Text as="p" variant="bodyMd" tone="subdued">New Referrals</Text>
                    <Text as="p" variant="heading2xl">{metrics.recentActivity.referrals}</Text>
                  </BlockStack>
                </Box>
                <Box padding="300" background="bg-surface-secondary" borderRadius="200">
                  <BlockStack gap="100">
                    <Text as="p" variant="bodyMd" tone="subdued">New Conversions</Text>
                    <Text as="p" variant="heading2xl">{metrics.recentActivity.conversions}</Text>
                  </BlockStack>
                </Box>
                <Box padding="300" background="bg-surface-secondary" borderRadius="200">
                  <BlockStack gap="100">
                    <Text as="p" variant="bodyMd" tone="subdued">Total Clicks</Text>
                    <Text as="p" variant="heading2xl">{metrics.recentActivity.clicks}</Text>
                  </BlockStack>
                </Box>
              </div>
            </BlockStack>
          </Card>
        </BlockStack>
      </Layout.Section>
    </Layout>
  );

  const renderSettingsTab = () => (
    <Layout>
      <Layout.Section>
        <Card>
          <BlockStack gap="400">
            <Text as="h2" variant="headingMd">Program Settings</Text>
            
            <FormLayout>
              <FormLayout.Group>
                <TextField
                  label="Program Name"
                  value={formData.name}
                  onChange={(value) => setFormData({...formData, name: value})}
                  autoComplete="off"
                />
                
                <Select
                  label="Status"
                  options={[
                    {label: 'Active', value: 'true'},
                    {label: 'Inactive', value: 'false'},
                  ]}
                  value={formData.isActive.toString()}
                  onChange={(value) => setFormData({...formData, isActive: value === 'true'})}
                />
              </FormLayout.Group>

              <TextField
                label="Description"
                value={formData.description}
                onChange={(value) => setFormData({...formData, description: value})}
                multiline={3}
                autoComplete="off"
              />

              <FormLayout.Group>
                <Select
                  label="Commission Type"
                  options={[
                    {label: 'Percentage', value: 'percentage'},
                    {label: 'Fixed Amount', value: 'fixed_amount'},
                  ]}
                  value={formData.commissionType}
                  onChange={(value) => setFormData({...formData, commissionType: value})}
                />
                
                <TextField
                  label={`Commission ${formData.commissionType === 'percentage' ? 'Percentage' : 'Amount ($)'}`}
                  value={formData.commissionValue}
                  onChange={(value) => setFormData({...formData, commissionValue: value})}
                  type="number"
                  suffix={formData.commissionType === 'percentage' ? '%' : '$'}
                  autoComplete="off"
                />
              </FormLayout.Group>

              <FormLayout.Group>
                <TextField
                  label="Minimum Order Value"
                  value={formData.minimumOrderValue}
                  onChange={(value) => setFormData({...formData, minimumOrderValue: value})}
                  type="number"
                  prefix="$"
                  autoComplete="off"
                />
                
                <TextField
                  label="Maximum Commission"
                  value={formData.maximumCommission}
                  onChange={(value) => setFormData({...formData, maximumCommission: value})}
                  type="number"
                  prefix="$"
                  autoComplete="off"
                />
              </FormLayout.Group>

              <TextField
                label="Welcome Message"
                value={formData.welcomeMessage}
                onChange={(value) => setFormData({...formData, welcomeMessage: value})}
                multiline={3}
                helpText="This message will be shown to new referrers when they join"
                autoComplete="off"
              />

              <Checkbox
                label="Allow self-registration"
                checked={formData.allowSelfRegistration}
                onChange={(checked) => setFormData({...formData, allowSelfRegistration: checked})}
                helpText="Allow customers to register as referrers without invitation"
              />

              <InlineStack gap="200">
                <Button 
                  variant="primary" 
                  onClick={handleUpdate}
                  loading={isLoading}
                >
                  Save Changes
                </Button>
                <Button onClick={() => setFormData({
                  name: program.name,
                  description: program.description || '',
                  commissionType: program.commissionType,
                  commissionValue: program.commissionValue.toString(),
                  minimumOrderValue: program.minimumOrderValue?.toString() || '',
                  maximumCommission: program.maximumCommission?.toString() || '',
                  allowSelfRegistration: program.allowSelfRegistration,
                  welcomeMessage: program.welcomeMessage || '',
                  isActive: program.isActive
                })}>
                  Reset
                </Button>
              </InlineStack>
            </FormLayout>
          </BlockStack>
        </Card>
      </Layout.Section>
    </Layout>
  );

  return (
    <Frame>
      <Page
        backAction={{content: 'Programs', url: '/app'}}
        title={program.name}
        subtitle={program.description || undefined}
        titleMetadata={
          <Badge tone={program.isActive ? 'success' : 'critical'}>
            {program.isActive ? 'Active' : 'Inactive'}
          </Badge>
        }
        secondaryActions={[
          {
            content: 'Edit Program',
            onAction: () => setShowEditModal(true),
          },
          {
            content: 'Actions',
            onAction: () => setShowActionsPopover(!showActionsPopover),
          },
        ]}
      >
        <Popover
          active={showActionsPopover}
          activator={<div />}
          onClose={() => setShowActionsPopover(false)}
        >
          <ActionList items={actionItems} />
        </Popover>

        <Tabs tabs={tabs} selected={selectedTab} onSelect={setSelectedTab}>
          <Box paddingBlockStart="400">
            {selectedTab === 0 && renderOverviewTab()}
            {selectedTab === 1 && renderReferralsTab()}
            {selectedTab === 2 && renderReferrersTab()}
            {selectedTab === 3 && renderAnalyticsTab()}
            {selectedTab === 4 && renderSettingsTab()}
          </Box>
        </Tabs>
      </Page>

      {/* Edit Program Modal */}
      <Modal
        open={showEditModal}
        onClose={() => setShowEditModal(false)}
        title="Edit Program"
        primaryAction={{
          content: 'Save Changes',
          onAction: handleUpdate,
          loading: isLoading,
        }}
        secondaryActions={[
          {
            content: 'Cancel',
            onAction: () => setShowEditModal(false),
          },
        ]}
      >
        <Modal.Section>
          <FormLayout>
            <TextField
              label="Program Name"
              value={formData.name}
              onChange={(value) => setFormData({...formData, name: value})}
              autoComplete="off"
            />
            
            <TextField
              label="Description"
              value={formData.description}
              onChange={(value) => setFormData({...formData, description: value})}
              multiline={3}
              autoComplete="off"
            />

            <FormLayout.Group>
              <Select
                label="Commission Type"
                options={[
                  {label: 'Percentage', value: 'percentage'},
                  {label: 'Fixed Amount', value: 'fixed_amount'},
                ]}
                value={formData.commissionType}
                onChange={(value) => setFormData({...formData, commissionType: value})}
              />
              
              <TextField
                label={`Commission ${formData.commissionType === 'percentage' ? 'Percentage' : 'Amount ($)'}`}
                value={formData.commissionValue}
                onChange={(value) => setFormData({...formData, commissionValue: value})}
                type="number"
                suffix={formData.commissionType === 'percentage' ? '%' : '$'}
                autoComplete="off"
              />
            </FormLayout.Group>

            <Checkbox
              label="Program is active"
              checked={formData.isActive}
              onChange={(checked) => setFormData({...formData, isActive: checked})}
            />
          </FormLayout>
        </Modal.Section>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        open={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Delete Program"
        primaryAction={{
          content: 'Delete Program',
          onAction: handleDelete,
          loading: isLoading,
          destructive: true,
        }}
        secondaryActions={[
          {
            content: 'Cancel',
            onAction: () => setShowDeleteModal(false),
          },
        ]}
      >
        <Modal.Section>
          <BlockStack gap="200">
            <Text as="p">Are you sure you want to delete this program? This action cannot be undone.</Text>
            <Text as="p" tone="subdued">
              This will permanently delete the program and all associated referrals and data.
            </Text>
          </BlockStack>
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