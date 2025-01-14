import { Action, ActionPanel, Icon, showToast, open, Toast, launchCommand, LaunchType } from "@raycast/api";
import { MutatePromise } from "@raycast/utils";
import { useMemo } from "react";

import { getGitHubClient } from "../api/githubClient";
import { getErrorMessage } from "../helpers/errors";
import { getNotificationSubtitle, getNotificationTypeTitle, getGitHubURL } from "../helpers/notifications";
import { NotificationsResponse } from "../notifications";

export type Notification = NotificationsResponse["data"][0];

type NotificationActionsProps = {
  notification: Notification;
  userId?: string;
  mutateList: MutatePromise<Notification[] | undefined>;
};

export default function NotificationActions({ notification, userId, mutateList }: NotificationActionsProps) {
  const { octokit } = getGitHubClient();

  const url = useMemo(() => getGitHubURL(notification, userId), [notification, userId]);

  async function markNotificationAsRead() {
    await showToast({ style: Toast.Style.Animated, title: "Marking notification as read" });

    try {
      await octokit.rest.activity.markThreadAsRead({ thread_id: parseInt(notification.id) });
      await mutateList();
      await launchCommand({ name: "unread-notifications", type: LaunchType.UserInitiated });

      await showToast({
        style: Toast.Style.Success,
        title: "Marked notification as read",
      });
    } catch (error) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Failed marking notification as read",
        message: getErrorMessage(error),
      });
    }
  }

  async function openNotificationAndMarkAsRead() {
    try {
      await open(url);
      await octokit.rest.activity.markThreadAsRead({ thread_id: parseInt(notification.id) });
      await mutateList();
    } catch (error) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Failed opening notification",
        message: getErrorMessage(error),
      });
    }
  }

  async function acceptInvitation() {
    try {
      const invitations = await octokit.rest.repos.listInvitationsForAuthenticatedUser();

      const invitation = invitations.data.find(
        (invitation) => invitation.repository.url === notification.repository.url,
      );

      await octokit.rest.repos.acceptInvitationForAuthenticatedUser({
        invitation_id: invitation?.id || 0,
      });

      open(notification.repository.html_url);
      await mutateList();
    } catch (error) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Failed opening notification",
        message: getErrorMessage(error),
      });
    }
  }

  async function markAllNotificationsAsRead() {
    await showToast({ style: Toast.Style.Animated, title: "Marking all notifications as read" });

    try {
      await octokit.rest.activity.markNotificationsAsRead();
      await mutateList();
      await launchCommand({ name: "unread-notifications", type: LaunchType.UserInitiated });

      await showToast({
        style: Toast.Style.Success,
        title: "Marked all notifications as read",
      });
    } catch (error) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Failed marking all notification as read",
        message: getErrorMessage(error),
      });
    }
  }

  async function unsubscribe() {
    await showToast({ style: Toast.Style.Animated, title: "Unsubscribing" });

    try {
      await octokit.rest.activity.deleteThreadSubscription({ thread_id: parseInt(notification.id) });
      await mutateList();

      await showToast({
        style: Toast.Style.Success,
        title: "Unsubscribed",
      });
    } catch (error) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Failed unsubscribing",
        message: getErrorMessage(error),
      });
    }
  }

  return (
    <ActionPanel title={getNotificationSubtitle(notification)}>
      <Action
        title={notification.subject.type === "RepositoryInvitation" ? "Accept Invitation" : "Open in Browser"}
        icon={Icon.Globe}
        onAction={() =>
          notification.subject && notification.subject.type === "RepositoryInvitation"
            ? acceptInvitation()
            : notification.unread
              ? openNotificationAndMarkAsRead()
              : open(url)
        }
      />
      <ActionPanel.Section>
        {notification.unread ? (
          <>
            <Action
              title="Mark as Read"
              icon={Icon.Circle}
              shortcut={{ modifiers: ["cmd"], key: "enter" }}
              onAction={markNotificationAsRead}
            />

            <Action
              title="Mark All as Read"
              icon={Icon.Circle}
              shortcut={{ modifiers: ["cmd", "shift"], key: "enter" }}
              onAction={markAllNotificationsAsRead}
            />
          </>
        ) : null}

        <Action
          title="Unsubscribe"
          icon={Icon.BellDisabled}
          shortcut={{ modifiers: ["cmd"], key: "." }}
          onAction={unsubscribe}
        />
      </ActionPanel.Section>
      <ActionPanel.Section>
        <Action.CopyToClipboard
          content={url}
          title={`Copy ${getNotificationTypeTitle(notification)} URL`}
          shortcut={{ modifiers: ["cmd", "shift"], key: "," }}
        />

        <Action.CopyToClipboard
          content={notification.subject.title}
          title={`Copy ${getNotificationTypeTitle(notification)} Title`}
          shortcut={{ modifiers: ["cmd", "shift"], key: "," }}
        />
      </ActionPanel.Section>
      <ActionPanel.Section>
        <Action
          icon={Icon.ArrowClockwise}
          title="Refresh"
          onAction={mutateList}
          shortcut={{ modifiers: ["cmd"], key: "r" }}
        />
      </ActionPanel.Section>
    </ActionPanel>
  );
}
