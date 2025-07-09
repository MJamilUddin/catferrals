-- CreateTable
CREATE TABLE "ReferrerAccount" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "phone" TEXT,
    "shopifyCustomerId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isEmailVerified" BOOLEAN NOT NULL DEFAULT false,
    "emailVerificationToken" TEXT,
    "notificationEmail" BOOLEAN NOT NULL DEFAULT true,
    "notificationSms" BOOLEAN NOT NULL DEFAULT false,
    "totalReferrals" INTEGER NOT NULL DEFAULT 0,
    "totalConversions" INTEGER NOT NULL DEFAULT 0,
    "totalCommissionEarned" REAL NOT NULL DEFAULT 0,
    "totalCommissionPaid" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "lastLoginAt" DATETIME
);

-- CreateTable
CREATE TABLE "ReferralProgram" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "commissionType" TEXT NOT NULL,
    "commissionValue" REAL NOT NULL,
    "minimumOrderValue" REAL,
    "maximumCommission" REAL,
    "maxReferralsPerCustomer" INTEGER,
    "programEndDate" DATETIME,
    "allowSelfRegistration" BOOLEAN NOT NULL DEFAULT true,
    "welcomeMessage" TEXT,
    "termsAndConditions" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Referral" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "referrerAccountId" TEXT NOT NULL,
    "referrerCustomerId" TEXT NOT NULL,
    "referrerEmail" TEXT NOT NULL,
    "referrerName" TEXT,
    "referralCode" TEXT NOT NULL,
    "referralLink" TEXT NOT NULL,
    "refereeCustomerId" TEXT,
    "refereeEmail" TEXT,
    "refereeName" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "clickCount" INTEGER NOT NULL DEFAULT 0,
    "orderId" TEXT,
    "orderValue" REAL,
    "commissionAmount" REAL,
    "commissionPaid" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "convertedAt" DATETIME,
    "rewardedAt" DATETIME,
    "lastClickedAt" DATETIME,
    CONSTRAINT "Referral_programId_fkey" FOREIGN KEY ("programId") REFERENCES "ReferralProgram" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Referral_referrerAccountId_fkey" FOREIGN KEY ("referrerAccountId") REFERENCES "ReferrerAccount" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ReferralClick" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "referralId" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "referrer" TEXT,
    "country" TEXT,
    "city" TEXT,
    "clickedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReferralClick_referralId_fkey" FOREIGN KEY ("referralId") REFERENCES "Referral" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AppSettings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "defaultCommissionType" TEXT NOT NULL DEFAULT 'percentage',
    "defaultCommissionValue" REAL NOT NULL DEFAULT 10.0,
    "brandColor" TEXT DEFAULT '#007ace',
    "brandLogo" TEXT,
    "senderEmail" TEXT,
    "senderName" TEXT DEFAULT 'Referral Team',
    "trackingDomain" TEXT,
    "enableAnalytics" BOOLEAN NOT NULL DEFAULT true,
    "autoApproveReferrals" BOOLEAN NOT NULL DEFAULT true,
    "notifyOnConversion" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "ReferrerAccount_shop_idx" ON "ReferrerAccount"("shop");

-- CreateIndex
CREATE INDEX "ReferrerAccount_email_idx" ON "ReferrerAccount"("email");

-- CreateIndex
CREATE INDEX "ReferrerAccount_shopifyCustomerId_idx" ON "ReferrerAccount"("shopifyCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "ReferrerAccount_shop_email_key" ON "ReferrerAccount"("shop", "email");

-- CreateIndex
CREATE INDEX "ReferralProgram_shop_idx" ON "ReferralProgram"("shop");

-- CreateIndex
CREATE UNIQUE INDEX "Referral_referralCode_key" ON "Referral"("referralCode");

-- CreateIndex
CREATE INDEX "Referral_shop_idx" ON "Referral"("shop");

-- CreateIndex
CREATE INDEX "Referral_referralCode_idx" ON "Referral"("referralCode");

-- CreateIndex
CREATE INDEX "Referral_referrerAccountId_idx" ON "Referral"("referrerAccountId");

-- CreateIndex
CREATE INDEX "Referral_referrerCustomerId_idx" ON "Referral"("referrerCustomerId");

-- CreateIndex
CREATE INDEX "Referral_status_idx" ON "Referral"("status");

-- CreateIndex
CREATE INDEX "ReferralClick_referralId_idx" ON "ReferralClick"("referralId");

-- CreateIndex
CREATE INDEX "ReferralClick_clickedAt_idx" ON "ReferralClick"("clickedAt");

-- CreateIndex
CREATE UNIQUE INDEX "AppSettings_shop_key" ON "AppSettings"("shop");
