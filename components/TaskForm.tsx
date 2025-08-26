'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTasks } from '../lib/store'
import type { Task, UserRef } from '../lib/types'

/* -------------------------- схема формы (zod) -------------------------- */
const schema = z.object({
	id: z.string().optional(),
	title: z.string().min(1, 'Введите название задачи'),
	description: z.string().optional(),

	assignee: z.object({
		id: z.string(),
		email: z.string().optional(),
		name: z.string().optional(),
	}),

	creator: z.object({
		id: z.string(),
		email: z.string().optional(),
		name: z.string().optional(),
	}),

	coAssignees: z
		.array(
			z.object({
				id: z.string(),
				email: z.string().optional(),
				name: z.string().optional(),
			}),
		)
		.optional(),

	observers: z
		.array(
			z.object({
				id: z.string(),
				email: z.string().optional(),
				name: z.string().optional(),
			}),
		)
		.optional(),

	isImportant: z.boolean().optional(),
	dueDate: z.string().optional(),
	requireResult: z.boolean().optional(),

	repeatRule: z.object({
		isRecurring: z.boolean(),
		/** Время ежедневного создания, HH:mm */
		timeOfDay: z.string().optional(),
		/** Поле-плейсхолдер (пока без логики) */
		startsAt: z.string().optional(),
		/** Поле-плейсхолдер (пока без логики) */
		endsAtRaw: z.string().optional(),
	}),

	checklist: z
		.array(
			z.object({
				id: z.string(),
				text: z.string(),
				done: z.boolean(),
			}),
		)
		.optional(),

	attachments: z
		.array(
			z.object({
				id: z.string(),
				name: z.string(),
			}),
		)
		.optional(),
})

type FormValues = z.infer<typeof schema>

/* ------------------------ загрузка юзеров из Bitrix ------------------------ */
async function fetchUsers(): Promise<UserRef[]> {
	const res = await fetch('/api/bitrix/users', { cache: 'no-store' })
	const data = await res.json()
	if (!res.ok) throw new Error(data?.error || 'Не удалось получить пользователей')
	return data.users as UserRef[]
}

/* -------------------------------- компонент ------------------------------- */
export default function TaskForm({
	initial,
	onSaved,
	onCancel,
}: {
	initial?: Partial<Task>
	onSaved: (id: string) => void
	onCancel: () => void
}) {
	const upsert = useTasks(s => s.upsert)
	const getById = useTasks(s => s.getById)

	const [users, setUsers] = useState<UserRef[]>([])
	const [usersLoading, setUsersLoading] = useState<boolean>(true)
	const [usersError, setUsersError] = useState<string | null>(null)
	const [pushInfo, setPushInfo] = useState<string | null>(null)
	const [pushing, setPushing] = useState(false)

	const defaultAssignee = useMemo<UserRef>(() => ({ id: '0', email: '', name: 'Не выбран' }), [])
	const me = useMemo<UserRef>(() => ({ id: 'me', email: '', name: 'Я' }), [])

	const form = useForm<FormValues>({
		resolver: zodResolver(schema),
		defaultValues: {
			id: initial?.id,
			title: initial?.title || '',
			description: initial?.description || '',
			assignee: initial?.assignee || defaultAssignee,
			creator: initial?.creator || me,
			coAssignees: initial?.coAssignees || [],
			observers: initial?.observers || [],
			isImportant: initial?.isImportant || false,
			dueDate: initial?.dueDate || '',
			requireResult: initial?.requireResult || false,
			repeatRule: initial?.repeatRule || { isRecurring: false, timeOfDay: '05:00' },
			checklist: initial?.checklist || [],
			attachments: initial?.attachments || [],
		},
	})

	const {
		fields: checklistFields,
		append: checklistAppend,
		remove: checklistRemove,
		update: checklistUpdate,
	} = useFieldArray({ control: form.control, name: 'checklist' as const })

	/* ---------------------------- загрузка пользователей ---------------------------- */
	useEffect(() => {
		let mounted = true
		setUsersLoading(true)
		fetchUsers()
			.then(u => {
				if (mounted) {
					setUsers(u)
					setUsersError(null)
				}
			})
			.catch(e => {
				if (mounted) setUsersError(String(e?.message || e))
			})
			.finally(() => {
				if (mounted) setUsersLoading(false)
			})
		return () => {
			mounted = false
		}
	}, [])

	/* --------------------------------- сабмит --------------------------------- */
	async function onSubmit(values: FormValues) {
		setPushInfo(null)
		setPushing(true)

		// сохраняем локально
		const id = upsert(values as any)
		const saved = getById(id) // берём полностью собранный объект из стора

		// шлём на вебхук через наш серверный роут
		try {
			const res = await fetch(
				'https://primary-production-7f3e1.up.railway.app/webhook/003d77a8-3aab-4491-9ae3-ca5ec35578a6',
				{
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						event: initial?.id ? 'task.updated' : 'task.created',
						task: saved,
					}),
				},
			)
			const data = await res.json()
			if (data?.ok) {
				setPushInfo(`Вебхук: ${data.status} OK`)
			} else {
				setPushInfo(`Вебхук ошибка: ${data?.error || data?.status}`)
			}
		} catch (e: any) {
			setPushInfo(`Вебхук исключение: ${String(e?.message || e)}`)
		} finally {
			setPushing(false)
		}

		// открываем детальную карточку
		onSaved(id)
	}

	/* ------------------------------ удобные watch ------------------------------ */
	const selectedAssignee = form.watch('assignee')
	const selectedCreator = form.watch('creator')
	const isRecurring = form.watch('repeatRule.isRecurring')

	function findUserById(id: string): UserRef | undefined {
		return users.find(u => u.id === id)
	}

	return (
		<form className='space-y-6' onSubmit={form.handleSubmit(onSubmit)}>
			{/* Заголовок */}
			<div className='space-y-2'>
				<label className='block text-sm font-medium'>Введите название задачи</label>
				<input
					type='text'
					className='w-full rounded-xl border px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300'
					{...form.register('title')}
					placeholder='Название'
				/>
				{form.formState.errors.title && (
					<p className='text-red-600 text-sm'>{form.formState.errors.title.message}</p>
				)}
			</div>

			{/* Описание */}
			<div>
				<textarea
					className='w-full min-h-36 rounded-xl border px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-300'
					placeholder='Описание задачи'
					{...form.register('description')}
				/>
			</div>

			{/* Псевдо‑инструменты (файл/чек‑лист) */}
			<div className='flex items-center gap-3 text-sm text-gray-600'>
				<span className='px-2 py-1 rounded-lg bg-gray-100'>CoPilot</span>

				<button
					type='button'
					className='px-2 py-1 rounded-lg hover:bg-gray-100'
					onClick={() => {
						const name = prompt('Введите имя «прикреплённого файла» (псевдо)')
						if (name) {
							const current = form.getValues('attachments') || []
							form.setValue('attachments', [...current, { id: crypto.randomUUID(), name }])
						}
					}}>
					Файл
				</button>

				<span className='px-2 py-1 rounded-lg bg-gray-100 cursor-default'>Создать документ</span>
				<span className='px-2 py-1 rounded-lg bg-gray-100 cursor-default'>@ Отметить человека</span>
				<span className='px-2 py-1 rounded-lg bg-gray-100 cursor-default'>«Цитата»</span>

				<button
					type='button'
					className='px-2 py-1 rounded-lg hover:bg-gray-100'
					onClick={() => {
						const text = prompt('Текст пункта чек-листа')
						if (text) checklistAppend({ id: crypto.randomUUID(), text, done: false })
					}}>
					Чек-лист
				</button>
			</div>

			{/* Участники */}
			<div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
				<div>
					<label className='block text-sm text-gray-600 mb-1'>Исполнитель</label>
					{usersLoading ? (
						<div className='text-sm text-gray-500'>Загружаю пользователей…</div>
					) : usersError ? (
						<div className='text-sm text-red-600'>Ошибка: {usersError}</div>
					) : (
						<select
							className='w-full rounded-xl border px-3 py-2'
							value={selectedAssignee?.id || '0'}
							onChange={e => {
								const u = findUserById(e.target.value)
								form.setValue('assignee', u || defaultAssignee)
							}}>
							{[defaultAssignee, ...users].map(u => (
								<option key={u.id} value={u.id}>
									{(u.name || '').trim() || u.email || 'Без имени'}
								</option>
							))}
						</select>
					)}
				</div>

				<div>
					<label className='block text-sm text-gray-600 mb-1'>Постановщик</label>
					{usersLoading ? (
						<div className='text-sm text-gray-500'>Загружаю пользователей…</div>
					) : usersError ? (
						<div className='text-sm text-red-600'>Ошибка: {usersError}</div>
					) : (
						<select
							className='w-full rounded-xl border px-3 py-2'
							value={selectedCreator?.id || 'me'}
							onChange={e => {
								const u = findUserById(e.target.value)
								form.setValue('creator', u || me)
							}}>
							{[me, ...users].map(u => (
								<option key={u.id} value={u.id}>
									{(u.name || '').trim() || u.email || 'Без имени'}
								</option>
							))}
						</select>
					)}
				</div>
			</div>

			{/* Крайний срок + Важность */}
			<div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
				<div>
					<label className='block text-sm text-gray-600 mb-1'>Крайний срок</label>
					<input
						type='datetime-local'
						className='w-full rounded-xl border px-3 py-2'
						{...form.register('dueDate')}
					/>
				</div>
				<div className='flex items-center gap-2 mt-6'>
					<input type='checkbox' className='size-4' {...form.register('isImportant')} />
					<span>Это важная задача</span>
				</div>
			</div>

			{/* Регулярность (ежедневно) */}
			<div className='rounded-2xl border p-4 space-y-4'>
				<div className='flex items-center gap-3'>
					<input type='checkbox' className='size-4' {...form.register('repeatRule.isRecurring')} />
					<span className='font-medium'>Сделать задачу регулярной</span>
					<span className='ml-auto text-xs text-gray-500'>Повторение: каждый день</span>
				</div>

				{isRecurring && (
					<div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
						<div>
							<label className='block text-sm text-gray-600 mb-1'>Время создания задачи</label>
							<input
								type='time'
								className='w-full rounded-xl border px-3 py-2'
								{...form.register('repeatRule.timeOfDay')}
							/>
						</div>
						<div>
							<label className='block text-sm text-gray-600 mb-1'>Начинать повторение (поле)</label>
							<input
								type='date'
								className='w-full rounded-xl border px-3 py-2'
								{...form.register('repeatRule.startsAt')}
							/>
						</div>
						<div>
							<label className='block text-sm text-gray-600 mb-1'>Повторять до (поле)</label>
							<input
								type='text'
								placeholder='например, без даты окончания'
								className='w-full rounded-xl border px-3 py-2'
								{...form.register('repeatRule.endsAtRaw')}
							/>
						</div>
					</div>
				)}
			</div>

			{/* Результат задачи */}
			<div className='flex items-center gap-2'>
				<input type='checkbox' className='size-4' {...form.register('requireResult')} />
				<span>Не завершать задачу без результата</span>
			</div>

			{/* Чек‑лист */}
			{checklistFields.length > 0 && (
				<div>
					<div className='text-sm text-gray-600 mb-1'>Чек-лист</div>
					<ul className='space-y-2'>
						{checklistFields.map((item, idx) => (
							<li key={item.id} className='flex items-center gap-2'>
								<input
									type='checkbox'
									className='size-4'
									checked={form.getValues(`checklist.${idx}.done`)}
									onChange={e => checklistUpdate(idx, { ...item, done: e.target.checked })}
								/>
								<input
									className='flex-1 rounded-lg border px-3 py-1'
									value={form.getValues(`checklist.${idx}.text`)}
									onChange={e => checklistUpdate(idx, { ...item, text: e.target.value })}
								/>
								<button
									type='button'
									className='text-red-600 hover:underline'
									onClick={() => checklistRemove(idx)}>
									Удалить
								</button>
							</li>
						))}
					</ul>
				</div>
			)}

			{/* Псевдо‑вложения */}
			{form.getValues('attachments')?.length ? (
				<div>
					<div className='text-sm text-gray-600'>Вложения (псевдо):</div>
					<ul className='list-disc pl-5 text-sm'>
						{form.getValues('attachments')!.map(a => (
							<li key={a.id}>{a.name}</li>
						))}
					</ul>
				</div>
			) : null}

			{/* Кнопки */}
			<div className='flex justify-end gap-3 pt-2'>
				<button
					type='button'
					onClick={onCancel}
					className='px-4 py-2 rounded-xl border hover:bg-gray-50'>
					Отмена
				</button>
				<button
					type='submit'
					disabled={pushing}
					className='px-4 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50'>
					{pushing ? 'Отправляю...' : 'Сохранить'}
				</button>
				{pushInfo && <div className='text-sm text-gray-600'>{pushInfo}</div>}
			</div>
		</form>
	)
}
