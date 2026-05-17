# Firestore Security Specification - PodSoft

## Data Invariants
1. **User Profiles**: Only the authenticated user whose `uid` matches the document ID can create or update their profile.
2. **Studios**: Any authenticated user can create a studio. Only the `ownerId` can update or delete it.
3. **Scenes**: Must specify a `studioId`. Only the owner of the associated `studioId` can create, update, or delete scenes.
4. **SceneItems**: Must specify a `sceneId`. Only the owner of the scene (via studioId) can create, update, or delete scene items.
5. **Immutability**: `createdAt` and `ownerId` (on studios) must not change once set.
6. **Timestamps**: `createdAt` and `updatedAt` must be validated against `request.time`.

## The Dirty Dozen (Attack Payloads)
1. **Identity Spoofing**: User A tries to update User B's profile.
2. **Studio Hijack**: User A tries to change the `ownerId` of User B's studio to themselves.
3. **Orphaned Scene**: User A tries to create a scene with a `studioId` that doesn't exist.
4. **Unauthorized Scene Write**: User A tries to create a scene for User B's studio.
5. **Junk ID Poisoning**: User A sends a 1MB string as a studio ID.
6. **Shadow Field Injection**: User A adds `isAdmin: true` to their user profile.
7. **Terminal State Bypass**: (If applicable) User A tries to modify a "finished" recording status.
8. **PII Leak**: User A tries to 'get' User B's private email/phone.
9. **Recursive Read Attack**: User A tries to list all studios without a filter, expecting the rules to fail at O(n).
10. **Timestamp Fraud**: User A provides a year 2099 `createdAt` timestamp.
11. **Type Poisoning**: User A sets `scene.order` to a string instead of a number.
12. **Enum Violation**: User A sets `sceneItem.type` to "malicious-script" instead of "video".

## Test Runner (TDD)
(A conceptual verification of rules against the above payloads)
- `PERMISSION_DENIED` for all above.
