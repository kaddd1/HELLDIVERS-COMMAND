<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { ru } from '#lib/i18n/ru.ts';

	const links = [
		{ href: '/', label: ru.nav.career },
		{ href: '/analytics', label: ru.nav.analytics },
		{ href: '/war', label: ru.nav.war },
		{ href: '/data', label: ru.nav.data }
	] as const;

	function isActive(href: string): boolean {
		return href === '/' ? page.url.pathname === '/' : page.url.pathname.startsWith(href);
	}
</script>

<header class="border-b border-line bg-surface">
	<div class="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-4 md:flex-row md:items-center md:gap-8">
		<a href={resolve('/')} class="shrink-0">
			<span class="block font-display text-lg font-bold tracking-widest text-accent">
				{ru.app.name}
			</span>
			<span class="block text-xs text-text-muted">{ru.app.tagline}</span>
		</a>

		<nav aria-label={ru.nav.label} class="-mx-4 overflow-x-auto px-4 md:mx-0 md:ml-auto md:px-0">
			<ul class="flex gap-1">
				{#each links as link (link.href)}
					<li>
						<a
							href={resolve(link.href)}
							aria-current={isActive(link.href) ? 'page' : undefined}
							class="block border-b-2 px-3 py-2 font-display text-sm font-semibold tracking-widest whitespace-nowrap uppercase transition-colors
								{isActive(link.href)
								? 'border-accent text-accent'
								: 'border-transparent text-text-muted hover:text-text'}"
						>
							{link.label}
						</a>
					</li>
				{/each}
			</ul>
		</nav>
	</div>
</header>
