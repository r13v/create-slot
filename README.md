# Create Slot

Slots allows developers to render content elsewhere in a React application.

## Installation

```sh
npm install create-slot
```

## Usage

```tsx
import { createSlot } from "create-slot"

// Create slots
const Slots = {
  Sidebar: createSlot<{ onClick: () => void }>(),
  HeaderRight: createSlot(),
  Main: createSlot(),
}

const Header = () => {
  return (
    <div>
      <ul>
        <li>Home</li>
        <li>About</li>
        <li>Contact</li>
      </ul>

      <div>
        <Slots.HeaderRight.Host /> // <- Host is a component that renders the slot
      </div>
    </div>
  )
}

const Sidebar = () => {
  const onClick = () => {
    console.log("clicked")
  }

  return (
    <div>
      <Slots.Sidebar.Host onClick={onClick} /> // <- Pass props to the slot if needed
    </div>
  )
}

const Main = () => {
  return (
    <Slots.Main.Host>
      <div>Default content. Will be overridden by slot.</div>
    </Slots.Main.Host>
  )
}


const Page = ({ children }) => {
  return (
    <div>
      <Header />
      <Sidebar />
      <Main />
      {children}
    </div>
  )
}

const UserProfileFeature = () => {
  const [isOpen, setIsOpen] = useState(false)
  const hostProps = Slots.Sidebar.useProps()

  const onClick = () => {
    setIsOpen(true)
    hostProps.onClick()
  }

  return (
    <>
      <Slots.HeaderRight>
        <button onClick={onClick}>Profile</button>
      </Slots.HeaderRight>

      <Slots.Sidebar>
        <button onClick={onClick}>Profile</button>
      </Slots.Sidebar>

      {isOpen && (
        <Slots.Main>
          <div>User profile</div>
        </Slots.Main>
      )}
    </>
  )
}

const App = () => {
  return (
    <Page>
      <UserProfileFeature />
    </Page>
  )
}
```
