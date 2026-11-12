"use client";

import type { ReactNode } from "react";
import { Tabs } from "radix-ui";
import { History, Inbox, Bell } from "@/components/icons";
import ui from "./workspace-content.module.css";

export function ActivityViews({ timeline, processing, deliveries }: {
  timeline: ReactNode;
  processing: ReactNode;
  deliveries: ReactNode;
}) {
  return <Tabs.Root defaultValue="processing" className={ui.activityViews}>
    <Tabs.List aria-label="Activity views" className={ui.activityTabs}>
      <Tabs.Trigger value="processing"><Inbox size={17} /> Processing</Tabs.Trigger>
      <Tabs.Trigger value="timeline"><History size={17} /> Timeline</Tabs.Trigger>
      <Tabs.Trigger value="deliveries"><Bell size={17} /> Deliveries</Tabs.Trigger>
    </Tabs.List>
    <Tabs.Content value="processing" forceMount className={ui.activityView}>{processing}</Tabs.Content>
    <Tabs.Content value="timeline" forceMount className={ui.activityView}>{timeline}</Tabs.Content>
    <Tabs.Content value="deliveries" forceMount className={ui.activityView}>{deliveries}</Tabs.Content>
  </Tabs.Root>;
}
