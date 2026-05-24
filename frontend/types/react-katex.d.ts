declare module "react-katex" {
  import type { ReactElement } from "react"

  interface MathProps {
    math: string
    errorColor?: string
    renderError?: (error: Error) => ReactElement
  }

  export function InlineMath(props: MathProps): ReactElement
  export function BlockMath(props: MathProps): ReactElement
}
