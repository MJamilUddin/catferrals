import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, Form, useActionData, useSubmit } from "@remix-run/react";
import { useState } from "react";
import {
  Page,
  Layout,
  Card,
  Text,
  Button,
  TextField,
  BlockStack,
  Banner,
  InlineStack
} from "@shopify/polaris";
import db from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const shop = url.searchParams.get("shop");

  if (!shop) {
    return json({ error: "Missing shop parameter", program: null });
  }

  try {
    // Get active referral program
    const program = await db.referralProgram.findFirst({
      where: { 
        shop,
        isActive: true,
        allowSelfRegistration: true
      }
    });

    return json({ program, error: null, shop });
  } catch (error) {
    console.error("Error loading registration page:", error);
    return json({ error: "Failed to load registration page", program: null, shop });
  }
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const formData = await request.formData();
  const shop = formData.get("shop") as string;
  const email = formData.get("email") as string;
  const firstName = formData.get("firstName") as string;
  const lastName = formData.get("lastName") as string;
  const phone = formData.get("phone") as string;

  if (!shop || !email) {
    return json({ error: "Shop and email are required", success: false });
  }

  try {
    // Check if referrer already exists
    const existingReferrer = await db.referrerAccount.findFirst({
      where: { shop, email: email.toLowerCase() }
    });

    if (existingReferrer) {
      return json({ 
        error: "An account with this email already exists", 
        success: false,
        existingAccount: true
      });
    }

    // Get active program
    const activeProgram = await db.referralProgram.findFirst({
      where: { 
        shop, 
        isActive: true,
        allowSelfRegistration: true
      }
    });

    if (!activeProgram) {
      return json({ 
        error: "Registration is not currently available", 
        success: false 
      });
    }

    // Create referrer account
    const referrerAccount = await db.referrerAccount.create({
      data: {
        shop,
        email: email.toLowerCase(),
        firstName: firstName || null,
        lastName: lastName || null,
        phone: phone || null,
        isEmailVerified: false
      }
    });

    // Create initial referral
    const referralCode = Math.random().toString(36).substring(2, 10).toUpperCase();
    const referralLink = `https://${shop}?ref=${referralCode}`;

    await db.referral.create({
      data: {
        shop,
        programId: activeProgram.id,
        referrerAccountId: referrerAccount.id,
        referrerCustomerId: `account_${referrerAccount.id}`,
        referrerEmail: email.toLowerCase(),
        referrerName: `${firstName || ''} ${lastName || ''}`.trim() || null,
        referralCode,
        referralLink,
        status: "pending"
      }
    });

    return json({ 
      success: true, 
      message: "Registration successful! You can now access your referrer portal.",
      referrerEmail: email.toLowerCase(),
      shop
    });

  } catch (error) {
    console.error("Registration error:", error);
    return json({ 
      error: "Registration failed. Please try again.", 
      success: false 
    });
  }
};

export default function RegisterPage() {
  const { program, error, shop } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const submit = useSubmit();
  
  const [formData, setFormData] = useState({
    email: "",
    firstName: "",
    lastName: "",
    phone: ""
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const form = new FormData();
    form.append("shop", shop || "");
    form.append("email", formData.email);
    form.append("firstName", formData.firstName);
    form.append("lastName", formData.lastName);
    form.append("phone", formData.phone);
    
    submit(form, { method: "post" });
  };

  if (error || !program) {
    return (
      <Page title="Referral Program Registration">
        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">Registration Unavailable</Text>
                <Banner tone="critical">
                  <Text as="p">{error || "No active referral program found"}</Text>
                </Banner>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>
      </Page>
    );
  }

  if (actionData?.success) {
    return (
      <Page title="Registration Successful!">
        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">Welcome to the Referral Program!</Text>
                
                <Banner tone="success">
                  <Text as="p">{actionData.message}</Text>
                </Banner>

                <Text as="p" variant="bodyMd">
                  Your account has been created successfully. You can now access your referrer portal 
                  to get your unique referral links and start earning commissions.
                </Text>

                <Button 
                  variant="primary" 
                  onClick={() => {
                    const params = new URLSearchParams({
                      shop: actionData.shop || "",
                      email: actionData.referrerEmail || ""
                    });
                    window.location.href = `/portal?${params.toString()}`;
                  }}
                >
                  Go to Portal
                </Button>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>
      </Page>
    );
  }

  return (
    <Page title="Join Our Referral Program">
      <Layout>
        <Layout.Section>
          <Card>
            <Form onSubmit={handleSubmit}>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">{program.name}</Text>
                
                {program.description && (
                  <Text as="p" variant="bodyMd">{program.description}</Text>
                )}

                <Text as="p" variant="bodyMd">
                  Earn {program.commissionType === 'percentage' 
                    ? `${program.commissionValue}%` 
                    : `$${program.commissionValue}`} commission 
                  for every successful referral!
                </Text>

                {actionData?.error && (
                  <Banner tone="critical">
                    <Text as="p">{actionData.error}</Text>
                    {actionData.existingAccount && (
                      <Text as="p">
                        <Button 
                          variant="plain"
                          onClick={() => {
                            const params = new URLSearchParams({
                              shop: shop || "",
                              email: formData.email
                            });
                            window.location.href = `/portal?${params.toString()}`;
                          }}
                        >
                          Access your existing account instead
                        </Button>
                      </Text>
                    )}
                  </Banner>
                )}

                <InlineStack gap="400">
                  <TextField
                    label="First Name"
                    value={formData.firstName}
                    onChange={(value) => setFormData({...formData, firstName: value})}
                    autoComplete="given-name"
                  />
                  <TextField
                    label="Last Name"
                    value={formData.lastName}
                    onChange={(value) => setFormData({...formData, lastName: value})}
                    autoComplete="family-name"
                  />
                </InlineStack>

                <TextField
                  label="Email Address"
                  type="email"
                  value={formData.email}
                  onChange={(value) => setFormData({...formData, email: value})}
                  autoComplete="email"
                  requiredIndicator
                />

                <TextField
                  label="Phone Number (Optional)"
                  type="tel"
                  value={formData.phone}
                  onChange={(value) => setFormData({...formData, phone: value})}
                  autoComplete="tel"
                />

                {program.welcomeMessage && (
                  <Text as="p" variant="bodySm" tone="subdued">
                    {program.welcomeMessage}
                  </Text>
                )}

                <Button 
                  variant="primary" 
                  submit
                  disabled={!formData.email}
                >
                  Join Referral Program
                </Button>
              </BlockStack>
            </Form>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
} 