import React from "react";
import AcceptInvitation from "../components/accept-invite/AcceptInvite";

export default function AcceptInvitePage() {
  return (
    <React.Suspense fallback={<div>Loading...</div>}>
      <AcceptInvitation />
    </React.Suspense>
  );
}
