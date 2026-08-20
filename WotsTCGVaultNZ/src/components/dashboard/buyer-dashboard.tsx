"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { OrdersManager } from "@/components/dashboard/orders-manager";
import { SavedItemsPanel } from "@/components/dashboard/saved-items-panel";
import { FavoriteSellersPanel } from "@/components/dashboard/favorite-sellers-panel";
import { VerificationPanel } from "@/components/dashboard/verification-panel";
import { AccountSettingsPanel } from "@/components/dashboard/account-settings-panel";

export function BuyerDashboard() {
  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-10">
      <h1 className="text-3xl font-display font-bold mb-8">Buyer Dashboard</h1>
      <Tabs defaultValue="orders">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="orders">Orders</TabsTrigger>
          <TabsTrigger value="saved">Saved Items</TabsTrigger>
          <TabsTrigger value="sellers">Favorite Sellers</TabsTrigger>
          <TabsTrigger value="verification">Become a Seller</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>
        <TabsContent value="orders">
          <OrdersManager as="buyer" />
        </TabsContent>
        <TabsContent value="saved">
          <SavedItemsPanel />
        </TabsContent>
        <TabsContent value="sellers">
          <FavoriteSellersPanel />
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
