import { PageHeader } from "@/components/PageHeader";
import { deleteAccountAction, updateProfileAction } from "@/actions/users";
import { ActionForm } from "@/components/ActionForm";
import { AvatarEditor } from "@/components/AvatarEditor";
import { requireUser } from "@/lib/auth";
import { pool } from "@/lib/db";
import { getUserById } from "@/lib/queries/users";

/** Require login and render profile editing and account deletion for the current user. */
export default async function SettingsPage() {
  const me = await requireUser();
  const user = await getUserById(pool, me.id);
  if (!user) return null;

  return (
    <div className="settings-page">
      <PageHeader title="Settings" back={`/u/${user.handle}`} />
      <section className="card settings-section">
        <h2 className="mb-1 text-lg font-semibold">Edit profile</h2>
        <p className="muted mb-5">Make it easy for people to recognize you.</p>
        <ActionForm action={updateProfileAction} submitLabel="Save profile">
          <div>
            <label className="label" htmlFor="display_name">
              Display name
            </label>
            <input
              id="display_name"
              name="display_name"
              required
              maxLength={50}
              defaultValue={user.display_name}
              className="input"
            />
          </div>
          <div>
            <label className="label" htmlFor="handle">
              Handle
            </label>
            <input
              id="handle"
              name="handle"
              required
              pattern="[A-Za-z0-9_]{3,30}"
              defaultValue={user.handle}
              className="input"
            />
            <p className="muted mt-1">
              Your profile URL is /u/handle. Changing it does not affect your
              posts.
            </p>
          </div>
          <div>
            <label className="label" htmlFor="bio">
              Bio
            </label>
            <textarea
              id="bio"
              name="bio"
              rows={3}
              maxLength={500}
              defaultValue={user.bio ?? ""}
              className="input"
            />
          </div>
          <div>
            <span className="label">Avatar</span>
            <AvatarEditor
              imageId={user.avatar_image_id}
              name={user.display_name}
            />
          </div>
          <p className="muted">Email: {user.email}</p>
        </ActionForm>
      </section>

      <section className="card border-red-200">
        <h2 className="mb-2 text-lg font-semibold text-red-700">
          Delete account
        </h2>
        <p className="mb-3 text-sm">
          This permanently deletes your account, post content, likes, follows,
          collections and messages. Other people’s replies remain under
          deleted-post placeholders. It cannot be undone.
        </p>
        <ActionForm
          action={deleteAccountAction}
          submitLabel="Delete my account"
          buttonClassName="btn-danger"
        >
          <label className="label" htmlFor="confirm_handle">
            Type your handle <code>{user.handle}</code> to confirm
          </label>
          <input
            id="confirm_handle"
            name="confirm_handle"
            required
            autoComplete="off"
            className="input"
          />
        </ActionForm>
      </section>
    </div>
  );
}
