package com.kjh.groupware.domain.file;

import java.io.OutputStream;

final class OutputStreamDiscard extends OutputStream {

    static final OutputStreamDiscard INSTANCE = new OutputStreamDiscard();

    private OutputStreamDiscard() {
    }

    @Override
    public void write(int b) {
    }
}
