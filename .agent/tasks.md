# Task: Restore Document/Attachment Upload Feature

The user wants to restore the "Document/Attachment" upload feature in the vault creation wizard (Step 1). It was previously present but removed.

## Steps

1.  [ ] Identify the removed code/logic for file attachments.
    *   Check `git log` for `frontend/components/assistant-ui/tools/vault-creation-wizard/wizard.tsx`.
    *   Look for "attachment", "document", or "file" in previous commits.
2.  [ ] Restore the UI components in `wizard.tsx`.
    *   Add file input field in "willDetails" step (Single file, optional).
    *   Add file display/remove logic.
3.  [ ] Update state management in `types.ts` and `constants.ts`.
    *   Change `attachments` array to single `attachment: File | null`.
4.  [ ] Restore/Implement logic to handle file upload.
    *   File reading (FileReader).
    *   Storage logic (how it's packed into the payload).
5.  [ ] Verify the implementation.
