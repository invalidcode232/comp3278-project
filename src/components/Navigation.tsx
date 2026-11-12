"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { logoutAction } from "@/actions/auth";
import { Menu } from "./Menu";
import { Icon, type IconName } from "./Icon";

/** Responsive navigation rail/bottom bar with route-aware selected states. */
export function Navigation({
  handle,
  composer,
}: {
  /** Signed-in public handle, or null for a visitor. */
  handle: string | null;
  /** Server-rendered creation dialog, absent for public visitors. */
  composer: ReactNode;
}) {
  const path = usePathname();
  /** Main destinations map existing project capabilities to the reference shell. */
  const links: {
    /** Destination URL. */ href: string;
    /** Accessible name. */ label: string;
    /** Navigation glyph. */ icon: IconName;
  }[] = [
    { href: "/", label: "Home", icon: "home" },
    { href: "/topics", label: "Topics", icon: "search" },
    { href: "/messages", label: "Messages", icon: "send" },
    {
      href: handle ? `/u/${handle}` : "/login",
      label: "Profile",
      icon: "user",
    },
  ];
  return (
    <>
      <header className="mobile-header">
        <Link href="/" className="brand-word">
          Threadly
        </Link>
        <Link
          href={handle ? "/collections" : "/login"}
          className="icon-button"
          aria-label={handle ? "Collections" : "Log in"}
        >
          <Icon name={handle ? "bookmark" : "user"} />
        </Link>
      </header>
      <nav className="navigation" aria-label="Main navigation">
        <Link href="/" className="brand-logo" aria-label="Threadly home">
          @
        </Link>
        <div className="nav-items">
          {links.map(
            /** Render a selected state only for the current destination's route family. */
            (item, index) => (
              <div className="nav-item" key={item.label}>
                {index === 2 && handle && (
                  <div className="nav-compose">{composer}</div>
                )}
                <Link
                  href={item.href}
                  className="nav-link"
                  aria-label={item.label}
                  title={item.label}
                  aria-current={
                    (
                      item.href === "/"
                        ? path === "/"
                        : path.startsWith(item.href)
                    )
                      ? "page"
                      : undefined
                  }
                >
                  <Icon name={item.icon} />
                </Link>
              </div>
            ),
          )}
          {handle && (
            <Link
              href="/collections"
              className="nav-link desktop-only"
              title="Collections"
              aria-label="Collections"
              aria-current={
                path.startsWith("/collections") ? "page" : undefined
              }
            >
              <Icon name="bookmark" />
            </Link>
          )}
        </div>
        <Menu
          label="Account menu"
          trigger={<Icon name="more" />}
          className="nav-menu"
        >
          {handle ? (
            <>
              <Link href="/settings">Settings</Link>
              <Link href="/collections">Collections</Link>
              <form action={logoutAction}>
                <button>Log out</button>
              </form>
            </>
          ) : (
            <>
              <Link href="/login">Log in</Link>
              <Link href="/signup">Sign up</Link>
            </>
          )}
        </Menu>
      </nav>
    </>
  );
}
