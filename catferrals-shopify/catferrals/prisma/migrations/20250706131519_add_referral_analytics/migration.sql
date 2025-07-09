-- CreateTable
CREATE TABLE "ReferralAnalytics" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "productId" TEXT,
    "referralCode" TEXT,
    "platform" TEXT,
    "method" TEXT,
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "ReferralAnalytics_shop_idx" ON "ReferralAnalytics"("shop");

-- CreateIndex
CREATE INDEX "ReferralAnalytics_eventType_idx" ON "ReferralAnalytics"("eventType");

-- CreateIndex
CREATE INDEX "ReferralAnalytics_referralCode_idx" ON "ReferralAnalytics"("referralCode");

-- CreateIndex
CREATE INDEX "ReferralAnalytics_createdAt_idx" ON "ReferralAnalytics"("createdAt");
