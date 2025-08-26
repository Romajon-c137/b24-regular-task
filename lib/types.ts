export type UserRef = { id: string; email: string; name?: string };

export type ChecklistItem = { id: string; text: string; done: boolean };

export type RepeatRule = {
  isRecurring: boolean;
  timeOfDay?: string;      // HH:mm — каждый день в это время
  startsAt?: string;       // ISO (поле-плейсхолдер)
  endsAtRaw?: string;      // произвольное поле-плейсхолдер (пока без логики)
};

export type Attachment = { id: string; name: string };

export type Task = {
  id: string;
  title: string;
  description?: string;
  assignee: UserRef;
  creator: UserRef;
  coAssignees?: UserRef[];
  observers?: UserRef[];
  isImportant?: boolean;
  dueDate?: string;           // ISO
  requireResult?: boolean;
  checklist?: ChecklistItem[];
  attachments?: Attachment[];
  createdAt: string;          // ISO
  repeatRule: RepeatRule;
};
