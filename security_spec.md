# Security Specification for CampusWall

## Data Invariants
1. A post must have a valid authorId matching the authenticated user's UID.
2. Users cannot modify the `authorId`, `authorName`, or `createdAt` of a post after creation.
3. Votes are stored in a `voters` map on the post: `{ uid: voteValue }` where voteValue is 1 (up) or -1 (down).
4. Users can only vote once per post (handled by map key being the UID).
5. Timestamps must be server-generated.

## The "Dirty Dozen" Payloads (Denied)
1. Creating a post with a different UID.
2. Updating someone else's post title.
3. Increasing upvotes count without adding self to voters map.
4. Setting status to "Resolved" as a regular student (status transitions logic).
5. Setting own user role to "Admin".
6. Overwriting someone else's comment.
7. Post ID with 1MB of junk characters.
8. Comment with empty text or text > 10,000 chars.
9. Modifying `createdAt` during update.
10. Setting extremely large upvote counts directly.
11. Reading PII (email/biography) of another user (if isolated).
12. Creating a post without a title.

## Implementation Plan
- Use `isValidPost()`, `isValidComment()`, `isValidUser()` helpers.
- Enforce `affectedKeys().hasOnly()` for voting actions.
- Use `request.time` for all timestamps.
