import { deleteAccountAction, updateProfileAction } from "@/actions/users";
import { ActionForm } from "@/components/ActionForm";
import { Avatar } from "@/components/Avatar";
import { requireUser } from "@/lib/auth";
import { pool } from "@/lib/db";
import { getUserById } from "@/lib/queries/users";
import { ACCEPT_IMAGES } from "@/lib/limits";

/** Require login and render profile editing and account deletion for the current user. */
export default async function SettingsPage() {
  const me = await requireUser();
  const user = await getUserById(pool, me.id);
  if (!user) return null;

  return (
    <div className="space-y-6">
      <section className="card">
        <h1 className="mb-4 text-xl font-semibold">Edit profile</h1>
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
            <div className="flex items-center gap-4">
              <Avatar
                imageId={user.avatar_image_id}
                name={user.display_name}
                size={64}
              />
              <input
                type="file"
                name="avatar"
                accept={ACCEPT_IMAGES}
                className="text-sm"
              />
              {user.avatar_image_id && (
                <label className="text-sm">
                  <input
                    type="checkbox"
                    name="remove_avatar"
                    className="mr-1"
                  />
                  Remove avatar
                </label>
              )}
            </div>
          </div>
          <p className="muted">Email: {user.email}</p>
        </ActionForm>
      </section>

      <section className="card border-red-200">
        <h2 className="mb-2 text-lg font-semibold text-red-700">
          Delete account
        </h2>
        <p className="mb-3 text-sm">
          This permanently deletes your account with all your threads, comments,
          likes, follows, collections and messages. It cannot be undone.
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
