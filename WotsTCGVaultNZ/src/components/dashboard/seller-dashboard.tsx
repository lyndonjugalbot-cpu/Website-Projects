"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ListingsManager } from "@/components/dashboard/listings-manager";
import { OrdersManager } from "@/components/dashboard/orders-manager";
import { PayoutsPanel } from "@/components/dashboard/payouts-panel";
import { VerificationPanel } from "@/components/dashboard/verification-panel";
import { AccountSettingsPanel } from "@/components/dashboard/account-settings-panel";

export function SellerDashboard() {
  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-10">
      <h1 className="text-3xl font-display font-bold mb-8">Seller Dashboard</h1>
      <Tabs defaultValue="listings">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="listings">Listings</TabsTrigger>
          <TabsTrigger value="orders">Orders</TabsTrigger>
          <TabsTrigger value="payouts">Payouts</TabsTrigger>
          <TabsTrigger value="verification">Verification</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>
        <TabsContent value="listings">
          <ListingsManager />
        </TabsContent>
        <TabsContent value="orders">
          <OrdersManager as="seller" />
        </TabsContent>
        <TabsContent value="payouts">
          <PayoutsPanel />
        </TabsContent>
        <TabsContent value="verification">
          <VerificationPanel />
        </TabsContent>
        <TabsContent value="settings">
          <AccountSettingsPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}
