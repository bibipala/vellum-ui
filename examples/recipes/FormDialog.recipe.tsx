import { useState } from 'react'
import {
  Avatar,
  Button,
  DatePicker,
  Form,
  Input,
  ListItem,
  Modal,
  Page,
  Panel,
  Pill,
  Select,
  Stack,
  Text,
  useMessage,
} from 'vellum-ui'

// —— Data of the recipe: replace with your API ——

type Role = 'admin' | 'member' | 'guest'

interface Member {
  readonly id: string
  readonly name: string
  readonly email: string
  readonly role: Role
  /** An ISO date, or null for permanent access. */
  readonly expires: string | null
  readonly invited: boolean
}

/** The values of the form, as Form passes them to `onFinish`. */
interface InviteValues {
  readonly name: string
  readonly email: string
  readonly role: Role
  readonly expires: string | null
  readonly note?: string
}

const MEMBERS: readonly Member[] = [
  {
    id: 'm1',
    name: 'Alex Morgan',
    email: 'alex.morgan@example.com',
    role: 'admin',
    expires: null,
    invited: false,
  },
  {
    id: 'm2',
    name: 'Sam Lee',
    email: 'sam.lee@example.com',
    role: 'member',
    expires: null,
    invited: false,
  },
  {
    id: 'm3',
    name: 'Jordan Park',
    email: 'jordan.park@example.com',
    role: 'guest',
    expires: '2026-12-31',
    invited: false,
  },
]

const ROLES: readonly { readonly value: Role; readonly label: string }[] = [
  { value: 'admin', label: 'Admin: manages members and settings' },
  { value: 'member', label: 'Member: works on all projects' },
  { value: 'guest', label: 'Guest: sees shared projects only' },
]

const ROLE_LABEL: Record<Role, string> = { admin: 'Admin', member: 'Member', guest: 'Guest' }

// Dates without a time are formatted in UTC, so that they do not move by a day in other time zones
const day = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeZone: 'UTC' })
const formatDay = (iso: string) => day.format(new Date(iso))

/** Today as an ISO date in the local time zone, the format DatePicker uses. */
function today(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// —— A simulated server, so that the recipe runs without a network ——

const LATENCY = 600

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

/** Checks on the server whether an address is already a member (an asynchronous validation). */
async function findMember(members: readonly Member[], email: string) {
  await wait(LATENCY / 2)
  return members.find((m) => m.email === email.trim().toLowerCase())
}

/** Sends the invitation. Addresses at "example.invalid" are rejected, so that the failure can be seen. */
async function sendInvitation(values: InviteValues): Promise<Member> {
  await wait(LATENCY)
  if (values.email.endsWith('@example.invalid'))
    throw new Error('The mail server rejected the address.')
  return {
    id: `m${Date.now()}`,
    name: values.name.trim(),
    email: values.email.trim().toLowerCase(),
    role: values.role,
    expires: values.expires,
    invited: true,
  }
}

// —— The page ——

/**
 * Form dialog
 * A primary action opens a Modal with a Form: required fields, an email rule, an asynchronous check, a date
 * and a hint. The OK button submits the form and shows `okLoading` while the request runs; a message confirms
 * the result. Addresses at "example.invalid" fail, to show the error message.
 * @zh 表单弹窗
 * 主操作打开一个带 Form 的 Modal：必填字段、邮箱规则、异步校验、日期与提示文字。确认按钮提交表单，请求期间显示
 * `okLoading`；用消息条确认结果。「example.invalid」的地址会失败，用来展示错误消息。
 * @level basic
 */
export function FormDialog() {
  const message = useMessage()
  const [members, setMembers] = useState(MEMBERS)
  const [open, setOpen] = useState(false)
  const [sending, setSending] = useState(false)
  // The instance submits the form from the OK button, which is outside the <form>
  const [form] = Form.useForm<InviteValues>()
  const closeDialog = () => {
    // The external instance survives Modal's unmount. Reset while Form is still connected.
    form.resetFields()
    setOpen(false)
  }

  const invite = async (values: InviteValues) => {
    setSending(true)
    try {
      const member = await sendInvitation(values)
      setMembers((list) => [...list, member])
      // The dialog does not close by itself: close it after the request has succeeded
      closeDialog()
      message.success(`Invitation sent to ${member.email}`)
    } catch {
      // Keep the dialog open, so that nothing that was typed is lost
      message.error(
        `Couldn't send the invitation to ${values.email}. Check the address and try again.`,
      )
    } finally {
      setSending(false)
    }
  }

  return (
    <Page
      title="Members"
      subtitle="People who can open the projects of this workspace"
      actions={
        <Button variant="primary" icon="user-plus" onClick={() => setOpen(true)}>
          Invite member
        </Button>
      }
    >
      <Panel flush>
        <Stack gap={1} padding={2}>
          {members.map((m) => (
            <ListItem
              key={m.id}
              leading={<Avatar name={m.name} size={32} />}
              title={m.name}
              description={m.email}
              meta={
                m.invited ? (
                  <Pill tone="info">Invited</Pill>
                ) : m.expires ? (
                  <Text size="sm" tone="secondary">
                    Until{' '}
                    <Text as="time" dateTime={m.expires} size="sm" tone="secondary" numeric>
                      {formatDay(m.expires)}
                    </Text>
                  </Text>
                ) : (
                  <Pill>{ROLE_LABEL[m.role]}</Pill>
                )
              }
            />
          ))}
        </Stack>
      </Panel>

      <Modal
        title="Invite member"
        open={open}
        okText="Send invitation"
        okLoading={sending}
        onOk={() => form.submit()}
        onCancel={closeDialog}
      >
        {/* closeDialog resets both successful invitations and cancelled drafts before unmounting. */}
        <Form
          form={form}
          layout="vertical"
          initialValues={{ role: 'member', expires: null }}
          onFinish={invite}
          disabled={sending}
        >
          <Form.Item
            label="Name"
            name="name"
            rules={[
              { required: true, whitespace: true, message: 'Enter the name of the person' },
              { max: 80, message: 'Use at most 80 characters' },
            ]}
          >
            <Input autoFocus placeholder="For example: Riley Chen" />
          </Form.Item>
          <Form.Item
            label="Email"
            name="email"
            rules={[
              { required: true, message: 'Enter an email address' },
              { type: 'email', message: 'Enter a valid email address, such as name@example.com' },
              {
                // A rule can be asynchronous: return the error text, or nothing when the value is valid
                validator: async (value) => {
                  if (typeof value !== 'string' || !value) return undefined
                  const found = await findMember(members, value)
                  return found ? `${found.name} is already a member` : undefined
                },
              },
            ]}
          >
            <Input type="email" placeholder="name@example.com" />
          </Form.Item>
          <Form.Item label="Role" name="role" rules={[{ required: true }]}>
            <Select options={ROLES} />
          </Form.Item>
          <Form.Item label="Access until" name="expires" help="Leave it empty for permanent access">
            {/* The value is an ISO date such as '2026-12-31', or null */}
            <DatePicker block allowClear disabledDate={(date) => date < today()} />
          </Form.Item>
          <Form.Item label="Personal note" name="note" rules={[{ max: 500 }]}>
            <Input.TextArea autoSize={{ minRows: 2, maxRows: 6 }} />
          </Form.Item>
        </Form>
      </Modal>
    </Page>
  )
}
