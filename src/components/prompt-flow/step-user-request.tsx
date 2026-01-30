"use client";

import { MessageSquare } from "lucide-react";
import { TypingText } from "@/components/ui/typing-text";

interface StepUserRequestProps {
  userRequest: string | null;
}

export function StepUserRequest({ userRequest }: StepUserRequestProps) {
  if (!userRequest) {
    return <div className="text-muted-foreground text-sm">Waiting...</div>;
  }

  return (
    <div className="flex items-start gap-3">
      <MessageSquare className="w-5 h-5 text-blue-500 mt-0.5" />
      <p className="text-sm text-foreground font-medium">
        <TypingText text={userRequest} speed={10} />
      </p>
    </div>
  );
}
