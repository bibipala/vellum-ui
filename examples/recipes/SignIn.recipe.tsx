import { useState } from 'react'
import {
  Alert,
  Avatar,
  Button,
  Center,
  Checkbox,
  Divider,
  Form,
  Heading,
  Icon,
  Inline,
  Input,
  LinkButton,
  Panel,
  Stack,
  Text,
} from 'vellum-ui'

// —— Data of the recipe: replace with your API ——

/** The values of the form, as Form passes them to `onFinish`. */
interface SignInValues {
  readonly email: string
  readonly password: string
}

interface Account {
  readonly name: string
  readonly email: string
}

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

/** Signs in on a simulated server. Only the password "vellum" is accepted, so that the error can be seen. */
async function signIn(values: SignInValues, remember: boolean): Promise<Account> {
  await wait(700)
  // `remember` would choose between a session cookie and a lasting one
  void remember
  if (values.password !== 'vellum') throw new Error('Wrong email or password')
  const local = values.email.split('@')[0] ?? ''
  const name = local
    .split(/[._-]/)
    .filter(Boolean)
    .map((w) => w[0]?.toUpperCase() + w.slice(1))
    .join(' ')
  return { name: name || values.email, email: values.email }
}

/** Replace with the navigation of your router. */
function openSignUp() {
  window.location.hash = '#/sign-up'
}

// —— The page ——

/**
 * Sign-in page
 * A sign-in form in a centered column: Center with `width="form"`, a heading, and a Panel with a Form whose
 * submit button shows `loading` while the request runs. A failed attempt shows an Alert above the fields and keeps
 * what was typed; success replaces the form. The password "vellum" signs in, any other shows the error.
 * @zh 登录页
 * 居中一列中的登录表单：`width="form"` 的 Center、一个标题，以及放着 Form 的 Panel，请求期间提交按钮显示 `loading`。
 * 登录失败时在字段上方显示 Alert，已输入的内容保留；成功后表单换成登录结果。密码「vellum」可以登录，其他密码显示错误。
 * @level basic
 */
export function SignIn() {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [account, setAccount] = useState<Account | null>(null)
  // A plain control next to the fields: it needs no validation, so it does not go through Form
  const [remember, setRemember] = useState(true)

  const submit = async (values: SignInValues) => {
    setPending(true)
    setError(null)
    try {
      setAccount(await signIn(values, remember))
    } catch (e) {
      // The message of the server, in one sentence; the fields keep their values
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setPending(false)
    }
  }

  // A real app navigates to its first page here; the recipe shows who signed in
  if (account)
    return (
      <Center fill padding={5} width="form">
        <Panel>
          <Stack gap={4} align="center">
            <Avatar name={account.name} size={48} />
            <Stack gap={1} align="center">
              <Heading level={2}>Welcome, {account.name}</Heading>
              <Text tone="secondary">Signed in as {account.email}</Text>
            </Stack>
            <Button icon="logout" onClick={() => setAccount(null)}>
              Sign out
            </Button>
          </Stack>
        </Panel>
      </Center>
    )

  return (
    <Center fill padding={5} width="form">
      <Stack gap={5}>
        <Stack gap={2} align="center">
          <Icon name="layers" size={32} tone="accent" />
          <Heading level={2}>Sign in to Northwind</Heading>
          <Text tone="secondary">Use the email address of your workspace.</Text>
        </Stack>

        <Panel padding={5}>
          <Form<SignInValues>
            layout="vertical"
            initialValues={{ email: 'alex.morgan@example.com' }}
            onFinish={submit}
            // A new attempt starts clean: the error goes away as soon as a field changes
            onValuesChange={() => setError(null)}
            requiredMark={false}
          >
            <Stack gap={4}>
              {error && <Alert tone="danger" showIcon title={error} />}
              <Stack gap={0}>
                <Form.Item
                  label="Email"
                  name="email"
                  rules={[
                    { required: true, message: 'Enter your email address' },
                    { type: 'email', message: 'Enter a valid email address' },
                  ]}
                >
                  <Input type="email" autoComplete="username" />
                </Form.Item>
                <Form.Item
                  label="Password"
                  name="password"
                  rules={[{ required: true, message: 'Enter your password' }]}
                >
                  <Input.Password autoComplete="current-password" autoFocus />
                </Form.Item>
                <Inline justify="between">
                  <Checkbox checked={remember} onChange={setRemember} disabled={pending}>
                    Keep me signed in
                  </Checkbox>
                  <LinkButton onClick={() => setError('Password reset is not part of the recipe')}>
                    Forgot password?
                  </LinkButton>
                </Inline>
              </Stack>
              <Button variant="primary" type="submit" size="lg" block loading={pending}>
                Sign in
              </Button>
            </Stack>
          </Form>

          <Divider plain>or</Divider>

          <Button icon="key" size="lg" block disabled={pending}>
            Continue with single sign-on
          </Button>
        </Panel>

        <Inline justify="center" gap={1}>
          <Text tone="secondary">New to Northwind?</Text>
          <LinkButton onClick={openSignUp}>Create an account</LinkButton>
        </Inline>
      </Stack>
    </Center>
  )
}
