import { useEffect, useState } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useFetcher } from "@remix-run/react";
import {
  Page,
  Layout,
  Text,
  Card,
  Button,
  BlockStack,
  Box,
  List,
  Link,
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
} from "@shopify/polaris";
import { 
  PlusIcon, 
  ShareIcon, 
  ChartVerticalIcon,
  PersonIcon,
  OrderIcon 
} from "@shopify/polaris-icons";
import { TitleBar, useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  
  // Get referral programs for this shop
  const programs = await db.referralProgram.findMany({
    where: { shop: session.shop },
    include: {
      referrals: {
        include: {
          clicks: true
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  });

  // Calculate metrics
  const totalReferrals = programs.reduce((sum: number, program: any) => sum + program.referrals.length, 0);
  const totalClicks = programs.reduce((sum: number, program: any) => 
    sum + program.referrals.reduce((clickSum: number, referral: any) => clickSum + referral.clickCount, 0), 0
  );
  const convertedReferrals = programs.reduce((sum: number, program: any) => 
    sum + program.referrals.filter((r: any) => r.status === 'converted').length, 0
  );
  const totalCommissions = programs.reduce((sum: number, program: any) => 
    sum + program.referrals.reduce((commSum: number, referral: any) => commSum + (referral.commissionAmount || 0), 0), 0
  );

  const metrics = {
    totalPrograms: programs.length,
    totalReferrals,
    totalClicks,
    convertedReferrals,
    conversionRate: totalClicks > 0 ? ((convertedReferrals / totalClicks) * 100).toFixed(1) : '0',
    totalCommissions: totalCommissions.toFixed(2)
  };

  return json({ programs, metrics });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "create_program") {
    const program = await db.referralProgram.create({
      data: {
        shop: session.shop,
        name: formData.get("name") as string,
        description: formData.get("description") as string,
        commissionType: formData.get("commissionType") as string,
        commissionValue: parseFloat(formData.get("commissionValue") as string),
        minimumOrderValue: formData.get("minimumOrderValue") 
          ? parseFloat(formData.get("minimumOrderValue") as string) 
          : null,
        isActive: formData.get("isActive") === "true"
      }
    });
    return json({ success: true, program });
  }

  if (intent === "toggle_program") {
    const programId = formData.get("programId") as string;
    const isActive = formData.get("isActive") === "true";
    
    await db.referralProgram.update({
      where: { id: programId },
      data: { isActive }
    });
    
    return json({ success: true });
  }

  return json({ success: false });
};

export default function ReferralDashboard() {
  const { programs, metrics } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();
  
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    commissionType: 'percentage',
    commissionValue: '10',
    minimumOrderValue: '',
    isActive: true
  });

  const isLoading = fetcher.state === "submitting";

  useEffect(() => {
    if (fetcher.data?.success && 'program' in fetcher.data && fetcher.data.program) {
      shopify.toast.show("Referral program created successfully!");
      setShowCreateModal(false);
      setFormData({
        name: '',
        description: '',
        commissionType: 'percentage',
        commissionValue: '10',
        minimumOrderValue: '',
        isActive: true
      });
    }
  }, [fetcher.data, shopify]);

  const handleCreateProgram = () => {
    fetcher.submit(
      {
        intent: "create_program",
        ...formData,
        isActive: formData.isActive.toString()
      },
      { method: "POST" }
    );
  };

  const toggleProgram = (programId: string, currentStatus: boolean) => {
    fetcher.submit(
      {
        intent: "toggle_program",
        programId,
        isActive: (!currentStatus).toString()
      },
      { method: "POST" }
    );
  };

  // Prepare data for DataTable
  const programRows = programs.map(program => [
    program.name,
    <Badge tone={program.isActive ? "success" : "critical"}>
      {program.isActive ? "Active" : "Inactive"}
    </Badge>,
    `${program.commissionValue}${program.commissionType === 'percentage' ? '%' : '$'}`,
    program.referrals.length.toString(),
    program.referrals.filter(r => r.status === 'converted').length.toString(),
    `$${program.referrals.reduce((sum, r) => sum + (r.commissionAmount || 0), 0).toFixed(2)}`,
    <InlineStack gap="200">
      <Button 
        size="micro" 
        onClick={() => toggleProgram(program.id, program.isActive)}
      >
        {program.isActive ? "Pause" : "Activate"}
      </Button>
      <Button size="micro" variant="primary" url={`/app/programs/${program.id}`}>
        Manage
      </Button>
    </InlineStack>
  ]);

  return (
    <Page>
      <TitleBar title="Catferrals - Referral Dashboard">
        <button variant="primary" onClick={() => setShowCreateModal(true)}>
          <Icon source={PlusIcon} />
          New Program
        </button>
      </TitleBar>

      <BlockStack gap="500">
        {/* Metrics Cards */}
        <Layout>
          <Layout.Section variant="oneThird">
            <Card>
              <BlockStack gap="200">
                <InlineStack align="space-between">
                  <Text as="h3" variant="headingMd">Programs</Text>
                  <Icon source={ChartVerticalIcon} tone="base" />
                </InlineStack>
                <Text as="p" variant="heading2xl">{metrics.totalPrograms}</Text>
                <Text as="p" variant="bodyMd" tone="subdued">Total active programs</Text>
              </BlockStack>
            </Card>
          </Layout.Section>
          
          <Layout.Section variant="oneThird">
            <Card>
              <BlockStack gap="200">
                <InlineStack align="space-between">
                  <Text as="h3" variant="headingMd">Referrals</Text>
                  <Icon source={ShareIcon} tone="base" />
                </InlineStack>
                <Text as="p" variant="heading2xl">{metrics.totalReferrals}</Text>
                <Text as="p" variant="bodyMd" tone="subdued">Total referrals created</Text>
              </BlockStack>
            </Card>
          </Layout.Section>
          
          <Layout.Section variant="oneThird">
            <Card>
              <BlockStack gap="200">
                <InlineStack align="space-between">
                  <Text as="h3" variant="headingMd">Conversions</Text>
                  <Icon source={OrderIcon} tone="base" />
                </InlineStack>
                <Text as="p" variant="heading2xl">{metrics.convertedReferrals}</Text>
                <Text as="p" variant="bodyMd" tone="subdued">{metrics.conversionRate}% conversion rate</Text>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>

        {/* Revenue and Traffic */}
        <Layout>
          <Layout.Section variant="oneHalf">
            <Card>
              <BlockStack gap="200">
                <Text as="h3" variant="headingMd">Total Commissions</Text>
                <Text as="p" variant="heading2xl" tone="success">${metrics.totalCommissions}</Text>
                <Text as="p" variant="bodyMd" tone="subdued">Commissions earned through referrals</Text>
              </BlockStack>
            </Card>
          </Layout.Section>
          
          <Layout.Section variant="oneHalf">
            <Card>
              <BlockStack gap="200">
                <Text as="h3" variant="headingMd">Total Clicks</Text>
                <Text as="p" variant="heading2xl">{metrics.totalClicks}</Text>
                <Text as="p" variant="bodyMd" tone="subdued">Referral link clicks</Text>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>

        {/* Programs Table */}
        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="300">
                <InlineStack align="space-between">
                  <Text as="h2" variant="headingMd">Referral Programs</Text>
                  <Button 
                    variant="primary" 
                    icon={PlusIcon}
                    onClick={() => setShowCreateModal(true)}
                  >
                    New Program
                  </Button>
                </InlineStack>
                
                {programs.length === 0 ? (
                  <Box padding="400" background="bg-surface-secondary" borderRadius="200">
                    <BlockStack gap="300" align="center">
                      <Icon source={ShareIcon} tone="subdued" />
                      <BlockStack gap="100" align="center">
                        <Text as="h3" variant="headingMd" alignment="center">No referral programs yet</Text>
                        <Text as="p" variant="bodyMd" tone="subdued" alignment="center">
                          Create your first referral program to start tracking referrals and earning commissions.
                        </Text>
                      </BlockStack>
                      <Button variant="primary" onClick={() => setShowCreateModal(true)}>
                        Create First Program
                      </Button>
                    </BlockStack>
                  </Box>
                ) : (
                  <DataTable
                    columnContentTypes={['text', 'text', 'text', 'numeric', 'numeric', 'text', 'text']}
                    headings={['Program Name', 'Status', 'Commission', 'Referrals', 'Conversions', 'Revenue', 'Actions']}
                    rows={programRows}
                  />
                )}
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>

        {/* Quick Actions */}
        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">Quick Actions</Text>
                <InlineStack gap="300">
                  <Button 
                    variant="primary" 
                    icon={PlusIcon}
                    onClick={() => setShowCreateModal(true)}
                  >
                    Create Program
                  </Button>
                  <Button 
                    icon={PersonIcon}
                    url="/app/referrers"
                  >
                    Manage Referrers
                  </Button>
                  <Button 
                    icon={PersonIcon}
                    url="/app/referrals"
                  >
                    View All Referrals
                  </Button>
                  <Button 
                    icon={ChartVerticalIcon}
                    url="/app/analytics"
                  >
                    Analytics Dashboard
                  </Button>
                </InlineStack>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>
      </BlockStack>

      {/* Create Program Modal */}
      <Modal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Create New Referral Program"
        primaryAction={{
          content: 'Create Program',
          onAction: handleCreateProgram,
          loading: isLoading,
        }}
        secondaryActions={[
          {
            content: 'Cancel',
            onAction: () => setShowCreateModal(false),
          },
        ]}
      >
        <Modal.Section>
          <FormLayout>
            <TextField
              label="Program Name"
              value={formData.name}
              onChange={(value) => setFormData({...formData, name: value})}
              placeholder="e.g., Summer Referral Campaign"
              autoComplete="off"
            />
            
            <TextField
              label="Description"
              value={formData.description}
              onChange={(value) => setFormData({...formData, description: value})}
              placeholder="Describe your referral program"
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
            
            <TextField
              label="Minimum Order Value (Optional)"
              value={formData.minimumOrderValue}
              onChange={(value) => setFormData({...formData, minimumOrderValue: value})}
              type="number"
              prefix="$"
              placeholder="0.00"
              helpText="Minimum order value required for referral to qualify"
              autoComplete="off"
            />
            
            <Checkbox
              label="Activate program immediately"
              checked={formData.isActive}
              onChange={(checked) => setFormData({...formData, isActive: checked})}
            />
          </FormLayout>
        </Modal.Section>
      </Modal>
    </Page>
  );
}
