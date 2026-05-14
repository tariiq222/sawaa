declare module 'react-native-gifted-chat' {
  import type React from 'react';
  import type {
    StyleProp,
    TextInputProps,
    TextStyle,
    ViewStyle,
  } from 'react-native';

  export interface User {
    _id: string | number;
    name?: string;
    avatar?: string | number;
  }

  export interface IMessage {
    _id: string | number;
    text: string;
    createdAt: Date | number;
    user: User;
    image?: string;
    video?: string;
    audio?: string;
    system?: boolean;
    sent?: boolean;
    received?: boolean;
    pending?: boolean;
    quickReplies?: unknown;
  }

  interface SideStyle<T> {
    left?: StyleProp<T>;
    right?: StyleProp<T>;
  }

  export interface BubbleProps<TMessage extends IMessage = IMessage> {
    currentMessage?: TMessage;
    previousMessage?: TMessage;
    nextMessage?: TMessage;
    position?: 'left' | 'right';
    wrapperStyle?: SideStyle<ViewStyle>;
    textStyle?: SideStyle<TextStyle>;
  }

  export interface InputToolbarProps<TMessage extends IMessage = IMessage> {
    messages?: TMessage[];
    containerStyle?: StyleProp<ViewStyle>;
    primaryStyle?: StyleProp<ViewStyle>;
  }

  export interface SendProps<TMessage extends IMessage = IMessage> {
    text?: string;
    messageIdGenerator?: () => string;
    user?: User;
    onSend?: (messages: TMessage[], shouldResetInputToolbar?: boolean) => void;
    containerStyle?: StyleProp<ViewStyle>;
    children?: React.ReactNode;
  }

  export interface GiftedChatProps<TMessage extends IMessage = IMessage> {
    messages: TMessage[];
    onSend?: (messages: TMessage[]) => void;
    user: User;
    renderBubble?: (props: BubbleProps<TMessage>) => React.ReactNode;
    renderInputToolbar?: (
      props: InputToolbarProps<TMessage>,
    ) => React.ReactNode;
    renderSend?: (props: SendProps<TMessage>) => React.ReactNode;
    renderFooter?: () => React.ReactNode;
    isTyping?: boolean;
    isSendButtonAlwaysVisible?: boolean;
    textInputProps?: TextInputProps & {
      style?: StyleProp<TextStyle>;
    };
  }

  export const GiftedChat: <TMessage extends IMessage = IMessage>(
    props: GiftedChatProps<TMessage>,
  ) => React.ReactElement | null;
  export const Bubble: <TMessage extends IMessage = IMessage>(
    props: BubbleProps<TMessage>,
  ) => React.ReactElement | null;
  export const InputToolbar: <TMessage extends IMessage = IMessage>(
    props: InputToolbarProps<TMessage>,
  ) => React.ReactElement | null;
  export const Send: <TMessage extends IMessage = IMessage>(
    props: SendProps<TMessage>,
  ) => React.ReactElement | null;
}
